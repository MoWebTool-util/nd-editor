'use strict'

var Widget = require('nd-widget')

var env = require('./env')
var DOM = require('./dom')
var Range = require('./range')
var TreeWalker = require('./tree-walker')

var indexOf = Array.prototype.indexOf
var filter = Array.prototype.filter

var Squire = Widget.extend({

  Plugins: [{
    name: 'undo',
    starter: require('./plugins/undo')
  }, {
    name: 'keys',
    starter: require('./plugins/keys')
  }, {
    name: 'path',
    starter: require('./plugins/path')
  }, {
    name: 'observe',
    starter: require('./plugins/observe')
  }],

  attrs: {

    defaultBlockTag: 'DIV',
    defaultBlockProperties: null,

    parentNode: null,

    host: null,

    doc: {
      value: null,
      getter: function() {
        return this.element[0]
      }
    },

    win: {
      value: null,
      getter: function() {
        return this.getDocument().defaultView
      }
    },

    body: {
      value: null,
      getter: function() {
        return this.element[0].body
      }
    }
  },

  events: {
    blur: '_enableRestoreSelection',
    input: '_disableRestoreSelection',
    mousedown: '_disableRestoreSelection',
    touchstart: '_disableRestoreSelection',
    focus: '_restoreSelection'
  },

  _enableRestoreSelection: function() {
    this._restoreSelection = true
  },

  _disableRestoreSelection: function() {
    this._restoreSelection = false
  },

  _restoreSelection: function() {
    if (this._restoreSelection) {
      this.range.setSelection()
    }
  },

  initProps: function() {
    this.keyHandlers = {}

    this._hasZWS = false

    this.env = env
    this.dom = new DOM(this)
    this.range = new Range(this)
    // this.undo = new UndoManager(this);

    // this._ignoreChange = false;

    var events = this.events

    if (env.losesSelectionOnBlur) {
      // IE loses selection state of iframe on blur, so make sure we
      // cache it just before it loses focus.
      events.beforedeactivate = 'getSelection'
    }

    // Opera does not fire keydown repeatedly.
    events[env.isPresto ? 'keypress' : 'keydown'] = '_onKey'
  },

  getSelection: function() {
    this.range.getSelection()
  },

  setup: function() {
    // Fix IE<10's buggy implementation of Text#splitText.
    // If the split is at the end of the node, it doesn't insert the newly split
    // node into the document, and sets its value to undefined rather than ''.
    // And even if the split is not at the end, the original node is removed
    // from the document and replaced by another, rather than just having its
    // data shortened.
    // We used to feature test for this, but then found the feature test would
    // sometimes pass, but later on the buggy behaviour would still appear.
    // I think IE10 does not have the same bug, but it doesn't hurt to replace
    // its native fn too and then we don't need yet another UA category.
    if (env.isIElt11) {
      this.getWindow().Text.prototype.splitText = function(offset) {
        var afterSplit = this.ownerDocument.createTextNode(
            this.data.slice(offset)),
          next = this.nextSibling,
          parent = this.parentNode,
          toDelete = this.length - offset

        if (next) {
          parent.insertBefore(afterSplit, next)
        } else {
          parent.appendChild(afterSplit)
        }

        if (toDelete) {
          this.deleteData(offset, toDelete)
        }

        return afterSplit
      }
    }

    this.getBody().setAttribute('contenteditable', 'true')

    // Remove Firefox's built-in controls
    try {
      this.getDocument().execCommand('enableObjectResizing', false, 'false')
      this.getDocument().execCommand('enableInlineTableEditing', false, 'false')
    } catch (e) {
      // log(e)
    }

    this.setHTML('')
  },

  addKeyHandler: function(key, handler) {
    key.split(/\s+/).forEach(function(key) {
      this.keyHandlers[key] = handler
    }, this)
  },

  createElement: function(tag, props, children) {
    return this.dom.createElement(tag, props, children)
  },

  createTextNode: function(text) {
    return this.dom.createTextNode(text)
  },

  didError: function(error) {
    console.log(error)
  },

  getWindow: function() {
    return this.get('win')
  },

  getDocument: function() {
    return this.get('doc')
  },

  getBody: function() {
    return this.get('body')
  },

  // destroy: function() {
  //   if (this._mutation) {
  //     this._mutation.disconnect();
  //   }

  //   Squire.superclass.destroy.call(this);
  // },

  selectNode: function(node) {
    this.range.selectNode(node)
  },

  getSelectedNode: function(range) {
    return this.range.getSelectedNode(range)
  },

  getSelectedText: function() {
    return this.range.getSelectedText()
  },

  getPath: function() {
    return this.currentPath
  },

  _didAddZWS: function() {
    this._hasZWS = true
  },

  _removeZWS: function() {
    if (!this._hasZWS) {
      return
    }
    this.removeZWS(this.getBody())
    this._hasZWS = false
  },

  // --- Focus ---

  focus: function() {
    // FF seems to need the body to be focussed (at least on first load).
    // Chrome also now needs body to be focussed in order to show the cursor
    // (otherwise it is focussed, but the cursor doesn't appear).
    // Opera (Presto-variant) however will lose the selection if you call this!
    if (!env.isPresto) {
      this.getBody().focus()
    }

    this.getWindow().focus()

    return this
  },

  blur: function() {
    // IE will remove the whole browser window from focus if you call
    // win.blur() or body.blur(), so instead we call top.focus() to focus
    // the top frame, thus blurring this frame. This works in everything
    // except FF, so we need to call body.blur() in that as well.
    if (env.isGecko) {
      this.getBody().blur()
    }

    top.focus()

    return this
  },

  _saveRangeToBookmark: function(range) {
    var startNode = this.createElement('INPUT', {
        id: env.START_SELECTION_ID,
        type: 'hidden'
      }),
      endNode = this.createElement('INPUT', {
        id: env.END_SELECTION_ID,
        type: 'hidden'
      }),
      temp

    this.range.insertNodeInRange(range, startNode)
    range.collapse(false)
    this.range.insertNodeInRange(range, endNode)

    // In a collapsed range, the start is sometimes inserted after the end!
    if (startNode.compareDocumentPosition(endNode)
      & env.DOCUMENT_POSITION_PRECEDING) {
      startNode.id = env.END_SELECTION_ID
      endNode.id = env.START_SELECTION_ID
      temp = startNode
      startNode = endNode
      endNode = temp
    }

    range.setStartAfter(startNode)
    range.setEndBefore(endNode)
  },

  _getRangeAndRemoveBookmark: function(range/* , record */) {
    var doc = this.getDocument(),
      start = doc.getElementById(env.START_SELECTION_ID),
      end = doc.getElementById(env.END_SELECTION_ID)

    if (start && end) {
      var startContainer = start.parentNode,
        endContainer = end.parentNode,
        collapsed

      var _range = {
        startContainer: startContainer,
        endContainer: endContainer,
        startOffset: indexOf.call(startContainer.childNodes, start),
        endOffset: indexOf.call(endContainer.childNodes, end)
      }

      if (startContainer === endContainer) {
        _range.endOffset--
      }

      this.dom.detach(start)
      this.dom.detach(end)

      // Merge any text nodes we split
      this.dom.mergeInlines(startContainer, _range)

      if (startContainer !== endContainer) {
        this.dom.mergeInlines(endContainer, _range)
      }

      if (!range) {
        range = doc.createRange()
      }

      range.setStart(_range.startContainer, _range.startOffset)
      range.setEnd(_range.endContainer, _range.endOffset)
      collapsed = range.collapsed

      this.range.moveRangeBoundariesDownTree(range)

      if (collapsed) {
        range.collapse(true)
      }
    }

    return range || null
  },

  // --- Inline formatting ---

  // Looks for matching tag and attributes, so won't work
  // if <strong> instead of <b> etc.
  hasFormat: function(tag, attributes, range) {
    // 0. Get selection
    if (!range && !(range = this.range.getSelection())) {
      return false
    }

    // 1. Normalise the arguments
    tag = tag.toUpperCase()
    if (!attributes) {
      attributes = {}
    }

    // If the common ancestor is inside the tag we require, we definitely
    // have the format.
    var root = range.commonAncestorContainer,
      walker, node

    if (this.dom.getNearest(root, tag, attributes)) {
      return true
    }

    // If common ancestor is a text node and doesn't have the format, we
    // definitely don't have it.
    if (root.nodeType === env.TEXT_NODE) {
      return false
    }

    // Otherwise, check each text node at least partially contained within
    // the selection and make sure all of them have the format we want.
    walker = new TreeWalker(root, env.SHOW_TEXT, function(node) {
      return this.range.isNodeContainedInRange(range, node, true)
    }.bind(this), false)

    var seenNode = false

    while ((node = walker.nextNode())) {
      if (!this.dom.getNearest(node, tag, attributes)) {
        return false
      }

      seenNode = true
    }

    return seenNode
  },

  _addFormat: function(tag, attributes, range) {
    // If the range is collapsed we simply insert the node by wrapping
    // it round the range and focus it.
    var el, walker, startContainer, endContainer, startOffset, endOffset,
      node, needsFormat

    if (range.collapsed) {
      el = this.dom.fixCursor(this.createElement(tag, attributes))
      this.range.insertNodeInRange(range, el)
      range.setStart(el.firstChild, el.firstChild.length)
      range.collapse(true)
    }
    // Otherwise we find all the textnodes in the range (splitting
    // partially selected nodes) and if they're not already formatted
    // correctly we wrap them in the appropriate tag.
    else {
      // Create an iterator to walk over all the text nodes under this
      // ancestor which are in the range and not already formatted
      // correctly.
      //
      // In Blink/WebKit, empty blocks may have no text nodes, just a <br>.
      // Therefore we wrap this in the tag as well, as this will then cause it
      // to apply when the user types something in the block, which is
      // presumably what was intended.
      walker = new TreeWalker(
        range.commonAncestorContainer,
        env.SHOW_TEXT | env.SHOW_ELEMENT,
        function(node) {
          /* return (node.nodeType === env.TEXT_NODE ||
              node.nodeName === 'BR') && this.range.isNodeContainedInRange(range, node, true);
            */
          // ONLY INLINE AND CONTAINED NODES
          return this.dom.isInline(node)
            && this.range.isNodeContainedInRange(range, node, true)
        }.bind(this),
        false
      )

      // Start at the beginning node of the range and iterate through
      // all the nodes in the range that need formatting.
      startContainer = range.startContainer
      startOffset = range.startOffset
      endContainer = range.endContainer
      endOffset = range.endOffset

      // Make sure we start with a valid node.
      walker.currentNode = startContainer
      if (!walker.filter(startContainer)) {
        startContainer = walker.nextNode()
        startOffset = 0
      }

      // If there are no interesting nodes in the selection, abort
      if (!startContainer) {
        return range
      }

      do {
        node = walker.currentNode
        needsFormat = !this.dom.getNearest(node, tag, attributes)
        if (needsFormat) {
          // <br> can never be a container node, so must have a text node
          // if node == (end|start)Container
          if (node === endContainer && node.length > endOffset) {
            node.splitText(endOffset)
          }
          if (node === startContainer && startOffset) {
            node = node.splitText(startOffset)
            if (endContainer === startContainer) {
              endContainer = node
              endOffset -= startOffset
            }
            startContainer = node
            startOffset = 0
          }
          el = this.createElement(tag, attributes)
          this.dom.replaceWith(node, el)
          el.appendChild(node)
        }
      } while (walker.nextNode())

      // If we don't finish inside a text node, offset may have changed.
      if (endContainer.nodeType !== env.TEXT_NODE) {
        if (node.nodeType === env.TEXT_NODE) {
          endContainer = node
          endOffset = node.length
        } else {
          // If <br>, we must have just wrapped it, so it must have only
          // one child
          endContainer = node.parentNode
          endOffset = 1
        }
      }

      // Now set the selection to as it was before
      range = this.range.create(
        startContainer, startOffset, endContainer, endOffset)
    }
    return range
  },

  _removeFormat: function(tag, attributes, range, partial) {
    // Add bookmark
    this._saveRangeToBookmark(range)

    // We need a node in the selection to break the surrounding
    // formatted text.
    var doc = this.getDocument(),
      fixer

    if (range.collapsed) {
      if (env.cantFocusEmptyTextNodes) {
        fixer = doc.createTextNode(env.ZWS)
        this._didAddZWS()
      } else {
        fixer = doc.createTextNode('')
      }

      this.range.insertNodeInRange(range, fixer)
    }

    // Find block-level ancestor of selection
    var root = range.commonAncestorContainer

    while (this.dom.isInline(root)) {
      root = root.parentNode
    }

    // Find text nodes inside formatTags that are not in selection and
    // add an extra tag with the same formatting.
    var startContainer = range.startContainer,
      startOffset = range.startOffset,
      endContainer = range.endContainer,
      endOffset = range.endOffset,
      toWrap = [],
      examineNode = function(node, exemplar) {
        // If the node is completely contained by the range then
        // we're going to remove all formatting so ignore it.
        if (this.range.isNodeContainedInRange(range, node, false)) {
          return
        }

        var isText = (node.nodeType === env.TEXT_NODE),
          child, next

        // If not at least partially contained, wrap entire contents
        // in a clone of the tag we're removing and we're done.
        if (!this.range.isNodeContainedInRange(range, node, true)) {
          // Ignore bookmarks and empty text nodes
          if (node.nodeName !== 'INPUT'
            && (!isText || node.data)) {
            toWrap.push([exemplar, node])
          }
          return
        }

        // Split any partially selected text nodes.
        if (isText) {
          if (node === endContainer && endOffset !== node.length) {
            toWrap.push([exemplar, node.splitText(endOffset)])
          }
          if (node === startContainer && startOffset) {
            node.splitText(startOffset)
            toWrap.push([exemplar, node])
          }
        }
        // If not a text node, recurse onto all children.
        // Beware, the tree may be rewritten with each call
        // to examineNode, hence find the next sibling first.
        else {
          for (child = node.firstChild; child; child = next) {
            next = child.nextSibling
            examineNode(child, exemplar)
          }
        }
      }.bind(this),
      formatTags = filter.call(
        root.getElementsByTagName(tag),
        function(el) {
          return this.range.isNodeContainedInRange(range, el, true)
            && this.dom.hasTagAttributes(el, tag, attributes)
        }.bind(this)
      )

    if (!partial) {
      formatTags.forEach(function(node) {
        examineNode(node, node)
      })
    }

    // Now wrap unselected nodes in the tag
    toWrap.forEach(function(item) {
      // [ exemplar, node ] tuple
      var el = item[0].cloneNode(false),
        node = item[1]
      this.dom.replaceWith(node, el)
      el.appendChild(node)
    }, this)

    // and remove old formatting tags.
    formatTags.forEach(function(el) {
      this.dom.replaceWith(el, this.dom.empty(el))
    }, this)

    // Merge adjacent inlines:
    this._getRangeAndRemoveBookmark(range)

    if (fixer) {
      range.collapse(false)
    }

    var _range = {
      startContainer: range.startContainer,
      startOffset: range.startOffset,
      endContainer: range.endContainer,
      endOffset: range.endOffset
    }

    this.dom.mergeInlines(root, _range)

    range.setStart(_range.startContainer, _range.startOffset)
    range.setEnd(_range.endContainer, _range.endOffset)

    return range
  },

  changeFormat: function(add, remove, range, partial) {
    // Normalise the arguments and get selection
    if (!range && !(range = this.range.getSelection())) {
      return
    }

    // Save undo checkpoint
    // this.undo.record(range);
    this._getRangeAndRemoveBookmark(range, true)

    if (remove) {
      range = this._removeFormat(remove.tag.toUpperCase(),
        remove.attributes || {}, range, partial)
    }
    if (add) {
      range = this._addFormat(add.tag.toUpperCase(),
        add.attributes || {}, range)
    }

    this.range.setSelection(range)
    // this.path.update(range, true);

    // We're not still in an undo state
    // if (!env.canObserveMutations) {
    // this._docWasChanged();
    // }

    return this
  },

  removeEmptyInlines: function(root) {
    var children = root.childNodes,
      l = children.length,
      child
    while (l--) {
      child = children[l]
      if (child.nodeType === env.ELEMENT_NODE && !this.dom.isLeaf(child)) {
        this.removeEmptyInlines(child)
        if (this.dom.isInline(child) && !child.firstChild) {
          root.removeChild(child)
        }
      } else if (child.nodeType === env.TEXT_NODE && !child.data) {
        root.removeChild(child)
      }
    }
  },

  removeZWS: function(root) {
    var walker = new TreeWalker(root, env.SHOW_TEXT, function() {
        return true
      }, false),
      parent, node, index
    while ((node = walker.nextNode())) {
      while ((index = node.data.indexOf(env.ZWS)) > -1) {
        if (node.length === 1) {
          do {
            parent = node.parentNode
            parent.removeChild(node)
            node = parent
          } while (this.dom.isInline(node) && !this.dom.getLength(node))
          break
        } else {
          node.deleteData(index, 1)
        }
      }
    }
  },

  addLinks: function(frag) {
    var doc = frag.ownerDocument,
      walker = new TreeWalker(frag, env.SHOW_TEXT,
        function(node) {
          return !this.dom.getNearest(node, 'A')
        }.bind(this), false),
      node, data, parent, match, index, endIndex, child

    while ((node = walker.nextNode())) {
      data = node.data
      parent = node.parentNode

      while ((match = env.LINK_REGEXP.exec(data))) {
        index = match.index
        endIndex = index + match[0].length

        if (index) {
          child = doc.createTextNode(data.slice(0, index))
          parent.insertBefore(child, node)
        }

        child = doc.createElement('A')
        child.textContent = data.slice(index, endIndex)
        child.href = match[1]
          ? /^(?:ht|f)tps?:/.test(match[1])
          ? match[1]
          : 'http://' + match[1]
          : 'mailto:' + match[2]

        parent.insertBefore(child, node)
        node.data = data = data.slice(endIndex)
      }
    }
  },

  /*
    Two purposes:

    1. Remove nodes we don't want, such as weird <o:p> tags, comment nodes
       and whitespace nodes.
    2. Convert inline tags into our preferred format.
  */
  cleanTree: function(node, allowStyles) {
    var children = node.childNodes,
      i, l, child, nodeName, nodeType, rewriter, childLength,
      data, j, ll

    var spanToSemantic = {
      backgroundColor: {
        regexp: env.notWS,
        replace: function(doc, colour) {
          return this.dom.createElement('SPAN', {
            'class': 'highlight',
            style: 'background-color: ' + colour
          })
        }.bind(this)
      },
      color: {
        regexp: env.notWS,
        replace: function(doc, colour) {
          return this.dom.createElement('SPAN', {
            'class': 'colour',
            style: 'color:' + colour
          })
        }.bind(this)
      },
      fontWeight: {
        regexp: /^bold/i,
        replace: function(/* doc */) {
          return this.dom.createElement('STRONG')
        }.bind(this)
      },
      fontStyle: {
        regexp: /^italic/i,
        replace: function(/* doc */) {
          return this.dom.createElement('EM')
        }.bind(this)
      },
      fontFamily: {
        regexp: env.notWS,
        replace: function(doc, family) {
          return this.dom.createElement('SPAN', {
            'class': 'font',
            style: 'font-family:' + family
          })
        }.bind(this)
      },
      fontSize: {
        regexp: env.notWS,
        replace: function(doc, size) {
          return this.dom.createElement('SPAN', {
            'class': 'size',
            style: 'font-size:' + size
          })
        }.bind(this)
      }
    }

    var stylesRewriters = {
      SPAN: function(span, parent) {
        var style = span.style,
          doc = span.ownerDocument,
          attr, converter, css, newTreeBottom, newTreeTop, el

        for (attr in spanToSemantic) {
          if (spanToSemantic.hasOwnProperty(attr)) {
            converter = spanToSemantic[attr]
            css = style[attr]
            if (css && converter.regexp.test(css)) {
              el = converter.replace(doc, css)
              if (newTreeBottom) {
                newTreeBottom.appendChild(el)
              }
              newTreeBottom = el
              if (!newTreeTop) {
                newTreeTop = el
              }
            }
          }
        }

        if (newTreeTop) {
          newTreeBottom.appendChild(this.dom.empty(span))
          parent.replaceChild(newTreeTop, span)
        }

        return newTreeBottom || span
      }.bind(this),
      B: this.replaceWithTag('STRONG'),
      I: this.replaceWithTag('EM'),
      // S: this.replaceWithTag('S'),
      FONT: function(node, parent) {
        var face = node.face,
          size = node.size,
          colour = node.color,
          fontSpan, sizeSpan, colourSpan,
          newTreeBottom, newTreeTop
        if (face) {
          fontSpan = this.dom.createElement('SPAN', {
            'class': 'font',
            style: 'font-family:' + face
          })
          newTreeTop = fontSpan
          newTreeBottom = fontSpan
        }
        if (size) {
          sizeSpan = this.dom.createElement('SPAN', {
            'class': 'size',
            style: 'font-size:' + env.FONT_SIZES[size] + 'px'
          })
          if (!newTreeTop) {
            newTreeTop = sizeSpan
          }
          if (newTreeBottom) {
            newTreeBottom.appendChild(sizeSpan)
          }
          newTreeBottom = sizeSpan
        }
        if (colour && /^#?([\dA-F]{3}){1,2}$/i.test(colour)) {
          if (colour.charAt(0) !== '#') {
            colour = '#' + colour
          }
          colourSpan = this.dom.createElement('SPAN', {
            'class': 'colour',
            style: 'color:' + colour
          })
          if (!newTreeTop) {
            newTreeTop = colourSpan
          }
          if (newTreeBottom) {
            newTreeBottom.appendChild(colourSpan)
          }
          newTreeBottom = colourSpan
        }
        if (!newTreeTop) {
          newTreeTop = newTreeBottom = this.dom.createElement('SPAN')
        }
        parent.replaceChild(newTreeTop, node)
        newTreeBottom.appendChild(this.dom.empty(node))
        return newTreeBottom
      }.bind(this),
      TT: function(node, parent) {
        var el = this.dom.createElement('SPAN', {
          'class': 'font',
          style: 'font-family:menlo,consolas,"courier new",monospace'
        })
        parent.replaceChild(el, node)
        el.appendChild(this.dom.empty(node))
        return el
      }.bind(this)
    }

    for (i = 0, l = children.length; i < l; i += 1) {
      child = children[i]
      nodeName = child.nodeName
      nodeType = child.nodeType
      rewriter = stylesRewriters[nodeName]
      if (nodeType === env.ELEMENT_NODE) {
        childLength = child.childNodes.length
        if (rewriter) {
          child = rewriter(child, node)
        } else if (!env.ALLOWED_BLOCK.test(nodeName)
          && !this.dom.isInline(child)) {
          i -= 1
          l += childLength - 1
          node.replaceChild(this.dom.empty(child), child)
          continue
        } else if (!allowStyles && child.style.cssText) {
          child.removeAttribute('style')
        }
        if (childLength) {
          this.cleanTree(child, allowStyles)
        }
      } else {
        if (nodeType === env.TEXT_NODE) {
          data = child.data
          // Use \S instead of notWS, because we want to remove nodes
          // which are just nbsp, in order to cleanup <div>nbsp<br></div>
          // construct.
          if (/\S/.test(data)) {
            // If the parent node is inline, don't trim this node as
            // it probably isn't at the end of the block.
            if (this.dom.isInline(node)) {
              continue
            }
            j = 0
            ll = data.length
            if (!i || !this.dom.isInline(children[i - 1])) {
              while (j < ll && !env.notWS.test(data.charAt(j))) {
                j += 1
              }
              if (j) {
                child.data = data = data.slice(j)
                ll -= j
              }
            }
            if (i + 1 === l || !this.dom.isInline(children[i + 1])) {
              j = ll
              while (j > 0 && !env.notWS.test(data.charAt(j - 1))) {
                j -= 1
              }
              if (j < ll) {
                child.data = data.slice(0, j)
              }
            }
            continue
          }
          // If we have just white space, it may still be important if it
          // separates two inline nodes, e.g. "<a>link</a> <a>link</a>".
          else if (i && i + 1 < l
            && this.dom.isInline(children[i - 1])
            && this.dom.isInline(children[i + 1])) {
            child.data = ' '
            continue
          }
        }
        node.removeChild(child)
        i -= 1
        l -= 1
      }
    }
    return node
  },

  replaceWithTag: function(tag) {
    return function(node, parent) {
      var el = this.dom.createElement(tag)
      parent.replaceChild(el, node)
      el.appendChild(this.dom.empty(node))
      return el
    }.bind(this)
  },

  isLineBreak: function(br) {
    var block = br.parentNode,
      walker

    while (this.dom.isInline(block)) {
      block = block.parentNode
    }

    var notWSTextNode = function(node) {
      return node.nodeType === env.ELEMENT_NODE
        ? node.nodeName === 'BR'
        : env.notWS.test(node.data)
    }

    walker = new TreeWalker(
      block, env.SHOW_ELEMENT | env.SHOW_TEXT, notWSTextNode)

    walker.currentNode = br

    return !!walker.nextNode()
  },

  // <br> elements are treated specially, and differently depending on the
  // browser, when in rich text editor mode. When adding HTML from external
  // sources, we must remove them, replacing the ones that actually affect
  // line breaks with a split of the block element containing it (and wrapping
  // any not inside a block). Browsers that want <br> elements at the end of
  // each block will then have them added back in a later fixCursor method
  // call.
  cleanupBRs: function(root) {
    var brs = root.querySelectorAll('BR'),
      brBreaksLine = [],
      l = brs.length,
      i, br, block

    // Must calculate whether the <br> breaks a line first, because if we
    // have two <br>s next to each other, after the first one is converted
    // to a block split, the second will be at the end of a block and
    // therefore seem to not be a line break. But in its original context it
    // was, so we should also convert it to a block split.
    for (i = 0; i < l; i += 1) {
      brBreaksLine[i] = this.isLineBreak(brs[i])
    }
    while (l--) {
      br = brs[l]
      // Cleanup may have removed it
      block = br.parentNode
      if (!block) {
        continue
      }
      while (this.dom.isInline(block)) {
        block = block.parentNode
      }
      // If this is not inside a block, replace it by wrapping
      // inlines in a <div>.
      if (!this.dom.isBlock(block)) {
        this.dom.fixContainer(block)
      } else {
        // If it doesn't break a line, just remove it; it's not doing
        // anything useful. We'll add it back later if required by the
        // browser. If it breaks a line, split the block or leave it as
        // appropriate.
        if (brBreaksLine[l]) {
          // If in a <div>, split, but anywhere else we might change
          // the formatting too much (e.g. <li> -> to two list items!)
          // so just play it safe and leave it.
          if (block.nodeName !== 'DIV') {
            continue
          }
          this.dom.split(br.parentNode, br, block.parentNode)
        }
        this.dom.detach(br)
      }
    }
  },

  forEachBlock: function(fn, mutates, range) {
    if (!range && !(range = this.range.getSelection())) {
      return this
    }

    // Save undo checkpoint
    if (mutates) {
      // this.undo.record(range);
      this._getRangeAndRemoveBookmark(range, true)
    }

    var start = this.range.getStartBlockOfRange(range),
      end = this.range.getEndBlockOfRange(range)

    if (start && end) {
      do {
        if (fn(start) || start === end) {
          break
        }
      } while ((start = this.dom.getNextBlock(start)))
    }

    if (mutates) {
      this.range.setSelection(range)

      // Path may have changed
      // this.path.update(range, true);

      // We're not still in an undo state
      // if (!env.canObserveMutations) {
      // this._docWasChanged();
      // }
    }

    return this
  },

  modifyBlocks: function(modify, range) {
    if (!range && !(range = this.range.getSelection())) {
      return this
    }

    // 1. Save undo checkpoint and bookmark selection
    // if (this.undo.inUndo()) {
      // this._saveRangeToBookmark(range);
    // } else {
      // this.undo.record(range);
    // }

    // 2. Expand range to block boundaries
    this.range.expandRangeToBlockBoundaries(range)

    // 3. Remove range.
    var body = this.getBody(),
      frag
    this.range.moveRangeBoundariesUpTree(range, body)
    frag = this.range.extractContentsOfRange(range, body)

    // 4. Modify tree of fragment and reinsert.
    this.range.insertNodeInRange(range, modify.call(this, frag))

    // 5. Merge containers at edges
    if (range.endOffset < range.endContainer.childNodes.length) {
      this.dom.mergeContainers(range.endContainer.childNodes[range.endOffset])
    }
    this.dom.mergeContainers(range.startContainer.childNodes[range.startOffset])

    // 6. Restore selection
    this._getRangeAndRemoveBookmark(range)
    this.range.setSelection(range)
    // this.path.update(range, true);

    // 7. We're not still in an undo state
    // if (!env.canObserveMutations) {
    // this._docWasChanged();
    // }

    return this
  },

  _ensureBottomLine: function() {
    var body = this.getBody(),
      last = body.lastElementChild
    if (!last || last.nodeName !== this.get('defaultBlockTag') || !this.dom.isBlock(last)) {
      body.appendChild(this.dom.createDefaultBlock())
    }
  },

  // Ref: http://unixpapa.com/js/key.html
  _onKey: function(event) {
    var code = event.keyCode,
      key = env.KEYS[code],
      modifiers = '',
      range = this.range.getSelection()

    if (!key) {
      key = String.fromCharCode(code).toLowerCase()

      // Only reliable for letters and numbers
      if (!/^[A-Za-z0-9]$/.test(key)) {
        key = ''
      }
    }

    // On keypress, delete and '.' both have event.keyCode 46
    // Must check event.which to differentiate.
    if (env.isPresto && event.which === 46) {
      key = '.'
    }

    // Function keys
    if (111 < code && code < 124) {
      key = 'f' + (code - 111)
    }

    // We need to apply the backspace/delete handlers regardless of
    // control key modifiers.
    if (key !== 'backspace' && key !== 'delete') {
      if (event.altKey) {
        modifiers += 'alt+'
      }
      if (event.ctrlKey || event.metaKey) {
        modifiers += 'ctrl+'
      }
    }

    // However, on Windows, shift-delete is apparently "cut" (WTF right?), so
    // we want to let the browser handle shift-delete.
    if (event.shiftKey) {
      modifiers += 'shift+'
    }

    key = modifiers + key

    if (this.keyHandlers[key]) {
      this.keyHandlers[key](event, {
        editor: this,
        shortcut: key,
        range: range
      })
    } else if (key.length === 1 && !range.collapsed) {
      // Record undo checkpoint.
      // this.undo.record(range);
      this._getRangeAndRemoveBookmark(range, true)
      // Delete the selection
      this.range.deleteContentsOfRange(range)
      this._ensureBottomLine()
      this.range.setSelection(range)
      // this.path.update(range, true);
    }
  },

  // --- Get/Set data ---

  _getHTML: function() {
    return this.getBody().innerHTML
  },

  _setHTML: function(html) {
    var node = this.getBody()
    node.innerHTML = html

    do {
      this.dom.fixCursor(node)
    } while ((node = this.dom.getNextBlock(node)))

    // this._ignoreChange = true;
  },

  getHTML: function(withBookMark) {
    var brs = [],
      node, fixer, html, l, range
    if (withBookMark && (range = this.range.getSelection())) {
      this._saveRangeToBookmark(range)
    }
    if (env.useTextFixer) {
      node = this.getBody()
      while ((node = this.dom.getNextBlock(node))) {
        if (!node.textContent && !node.querySelector('BR')) {
          fixer = this.createElement('BR')
          node.appendChild(fixer)
          brs.push(fixer)
        }
      }
    }
    html = this._getHTML().replace(/\u200B/g, '')
    if (env.useTextFixer) {
      l = brs.length
      while (l--) {
        this.dom.detach(brs[l])
      }
    }
    if (range) {
      this._getRangeAndRemoveBookmark(range)
    }
    return html
  },

  setHTML: function(html) {
    var frag = this.getDocument().createDocumentFragment(),
      div = this.createElement('DIV'),
      child

    // Parse HTML into DOM tree
    div.innerHTML = html
    frag.appendChild(this.dom.empty(div))

    this.cleanTree(frag, true)
    this.cleanupBRs(frag)

    this.dom.fixContainer(frag)

    // Fix cursor
    var node = frag
    while ((node = this.dom.getNextBlock(node))) {
      this.dom.fixCursor(node)
    }

    // Don't fire an input event
    // this._ignoreChange = true;

    // Remove existing body children
    var body = this.getBody()
    while ((child = body.lastChild)) {
      body.removeChild(child)
    }

    // And insert new content
    body.appendChild(frag)
    this.dom.fixCursor(body)

    this.saveRange(body)

    return this
  },

  saveRange: function(body) {
    // IS THIS NECESSARY?
    // Reset the undo stack
    // this.undo.reset();
    // MAYBE NOT, RESET UNDO STATE ONLY
    // this.undo.inUndo(false);

    // Record undo state
    var range = this._getRangeAndRemoveBookmark()
      || this.range.create(body.firstChild, 0)

    // this.undo.record(range);
    this._getRangeAndRemoveBookmark(range, true)

    // IE will also set focus when selecting text so don't use
    // range.setSelection. Instead, just store it in lastSelection, so if
    // anything calls getSelection before first focus, we have a range
    // to return.
    this.range.setSelection(range)

    // this.path.update(range, true);
  },

  insertElement: function(el, range) {
    if (!range) {
      range = this.range.getSelection()
    }

    range.collapse(true)

    if (this.dom.isInline(el)) {
      this.range.insertNodeInRange(range, el)
      range.setStartAfter(el)
    } else {
      // Get containing block node.
      var body = this.getBody(),
        splitNode = this.range.getStartBlockOfRange(range) || body,
        parent, nodeAfterSplit

      // While at end of container node, move up DOM tree.
      while (splitNode !== body && !splitNode.nextSibling) {
        splitNode = splitNode.parentNode
      }

      // If in the middle of a container node, split up to body.
      if (splitNode !== body) {
        parent = splitNode.parentNode
        nodeAfterSplit = this.dom.split(parent, splitNode.nextSibling, body)
      }

      if (nodeAfterSplit) {
        body.insertBefore(el, nodeAfterSplit)
        range.setStart(nodeAfterSplit, 0)
        range.setStart(nodeAfterSplit, 0)
        this.range.moveRangeBoundariesDownTree(range)
      } else {
        body.appendChild(el)
        // Insert blank line below block.
        body.appendChild(this.dom.createDefaultBlock())
        range.setStart(el, 0)
        range.setEnd(el, 0)
      }

      this.focus()
      this.range.setSelection(range)
      // this.path.update(range);
    }

    return this
  },

  // Insert HTML at the cursor location. If the selection is not collapsed
  // insertTreeFragmentIntoRange will delete the selection so that it is replaced
  // by the html being inserted.
  insertHTML: function(html) {
    var range = this.range.getSelection(),
      frag = this.getDocument().createDocumentFragment(),
      div = this.createElement('DIV')

    // Parse HTML into DOM tree
    div.innerHTML = html
    frag.appendChild(this.dom.empty(div))

    // Record undo checkpoint
    // this.undo.record(range);
    this._getRangeAndRemoveBookmark(range, true)

    try {
      frag.normalize()
      this.addLinks(frag)
      this.cleanTree(frag, true)
      this.cleanupBRs(frag)
      this.removeEmptyInlines(frag)
      this.dom.fixContainer.call(this, frag)

      var node = frag
      while ((node = this.dom.getNextBlock(node))) {
        this.dom.fixCursor(node)
      }

      this.range.insertTreeFragmentIntoRange(range, frag)

      // if (!env.canObserveMutations) {
      // this._docWasChanged();
      // }

      range.collapse(false)
      this._ensureBottomLine()

      this.range.setSelection(range)
      // this.path.update(range, true);
    } catch (error) {
      this.didError(error)
    }

    return this
  }

})

module.exports = Squire
