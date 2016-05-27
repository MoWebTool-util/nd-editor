'use strict'

var env = require('./env')
var TreeWalker = require('./tree-walker')

var START_TO_START = 0 // Range.START_TO_START
var START_TO_END = 1 // Range.START_TO_END
var END_TO_END = 2 // Range.END_TO_END
var END_TO_START = 3 // Range.END_TO_START

var indexOf = Array.prototype.indexOf

var Range = function(editor) {
  this.editor = editor
  this.range = editor.getDocument().createRange()
  this.selection = editor.getWindow().getSelection()
  this._lastSelection = null
}

Range.prototype = {

  constructor: Range,

  create: function(range, startOffset, endContainer, endOffset) {
    if (range.cloneRange) {
      return range.cloneRange()
    }

    var domRange = this.range.cloneRange()

    domRange.setStart(range, startOffset)

    if (endContainer) {
      domRange.setEnd(endContainer, endOffset)
    } else {
      domRange.setEnd(range, startOffset)
    }

    return domRange
  },

  setSelection: function(range) {
    if (!range) {
      range = this._lastSelection
    }
    if (range) {
      this._restoreSelection = false
      this._lastSelection = range
      // iOS bug: if you don't focus the iframe before setting the
      // selection, you can end up in a state where you type but the input
      // doesn't get directed into the contenteditable area but is instead
      // lost in a black hole. Very strange.
      if (env.isIOS) {
        this._win.focus()
      }

      var sel = this.selection
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }

    return this
  },

  getSelection: function() {
    var sel = this.selection,
      selection, startContainer, endContainer

    function isOrContains( parent, node ) {
      while ( node ) {
        if ( node === parent ) {
          return true
        }
        node = node.parentNode
      }
      return false
    }

    if (sel.rangeCount) {
      selection = sel.getRangeAt(0).cloneRange()
      startContainer = selection.startContainer
      endContainer = selection.endContainer

      // FF can return the selection as being inside an <img>. WTF?
      if (startContainer && this.editor.dom.isLeaf(startContainer)) {
        selection.setStartBefore(startContainer)
      }

      if (endContainer && this.editor.dom.isLeaf(endContainer)) {
        selection.setEndBefore(endContainer)
      }
    }

    if (selection
      && isOrContains(this.editor.getBody(), selection.commonAncestorContainer)) {
      this._lastSelection = selection
    } else {
      selection = this._lastSelection
    }

    if (!selection) {
      selection = this.create(this.editor.getBody().firstChild, 0)
    }

    return selection
  },

  selectNode: function(node) {
    var range = this.getSelection()
    range.selectNode(node)

    // node.setAttribute('data-editor-selected', 1);

    this.setSelection(range)
  },

  getSelectedNode: function(range) {
    if (!range && !(range = this.getSelection())) {
      return
    }

    var commonAncestorContainer = range.commonAncestorContainer,
      startContainer = range.startContainer,
      startOffset = range.startOffset,
      endContainer = range.endContainer,
      endOffset = range.endOffset

    if (startContainer.nodeType === env.TEXT_NODE) {
      if (startContainer === endContainer) {
        // 选中全部 TEXT
        if (startContainer.nodeValue.length === endOffset - startOffset) {
          return startContainer.parentElement
        }
      } else {
        // 选中共同父节点的全部子节点
        if (startOffset === 0
          && endOffset === endContainer[endContainer.nodeType === env.TEXT_NODE ? 'nodeValue' : 'textContent'].length) {
          var childNodes = commonAncestorContainer.childNodes,
            childCount = childNodes.length
          if (childNodes[0] === startContainer
            && childNodes[childCount - 2] === endContainer) { // lastChild is BR
            return commonAncestorContainer
          }
        }
      }
    } else if (startContainer.nodeType === env.ELEMENT_NODE) {
      if (startContainer === endContainer) {
        // 选中单个 NODE
        if (1 === endOffset - startOffset) {
          return startContainer.childNodes[startOffset]
        }
      }
    }
  },

  getSelectedText: function() {
    var range = this.getSelection(),
      walker = new TreeWalker(
        range.commonAncestorContainer,
        env.SHOW_TEXT | env.SHOW_ELEMENT,
        function(node) {
          return this.isNodeContainedInRange(range, node, true)
        }.bind(this)
      ),
      startContainer = range.startContainer,
      endContainer = range.endContainer,
      node = walker.currentNode = startContainer,
      textContent = '',
      addedTextInBlock = false,
      value

    if (!walker.filter(node)) {
      node = walker.nextNode()
    }

    while (node) {
      if (node.nodeType === env.TEXT_NODE) {
        value = node.data
        if (value && (/\S/.test(value))) {
          if (node === endContainer) {
            value = value.slice(0, range.endOffset)
          }
          if (node === startContainer) {
            value = value.slice(range.startOffset)
          }
          textContent += value
          addedTextInBlock = true
        }
      } else if (node.nodeName === 'BR'
        || addedTextInBlock && !this.editor.dom.isInline(node)) {
        textContent += '\n'
        addedTextInBlock = false
      }
      node = walker.nextNode()
    }

    return textContent
  },

  getNodeBefore: function(node, offset) {
    var children = node.childNodes

    while (offset && node.nodeType === env.ELEMENT_NODE) {
      node = children[offset - 1]
      children = node.childNodes
      offset = children.length
    }

    return node
  },

  getNodeAfter: function(node, offset) {
    if (node.nodeType === env.ELEMENT_NODE) {
      var children = node.childNodes

      if (offset < children.length) {
        node = children[offset]
      } else {
        while (node && !node.nextSibling) {
          node = node.parentNode
        }

        if (node) {
          node = node.nextSibling
        }
      }
    }

    return node
  },

  insertNodeInRange: function(range, node) {
    // if (!node) {
    //   node = range;
    //   range = this.getSelection();
    // }
    // Insert at start.
    var startContainer = range.startContainer,
      startOffset = range.startOffset,
      endContainer = range.endContainer,
      endOffset = range.endOffset,
      parent, children, childCount, afterSplit

    // If part way through a text node, split it.
    if (startContainer.nodeType === env.TEXT_NODE) {
      parent = startContainer.parentNode
      children = parent.childNodes
      if (startOffset === startContainer.length) {
        startOffset = indexOf.call(children, startContainer) + 1
        if (range.collapsed) {
          endContainer = parent
          endOffset = startOffset
        }
      } else {
        if (startOffset) {
          afterSplit = startContainer.splitText(startOffset)
          if (endContainer === startContainer) {
            endOffset -= startOffset
            endContainer = afterSplit
          } else if (endContainer === parent) {
            endOffset += 1
          }
          startContainer = afterSplit
        }
        startOffset = indexOf.call(children, startContainer)
      }
      startContainer = parent
    } else {
      children = startContainer.childNodes
    }

    childCount = children.length

    if (startOffset === childCount) {
      startContainer.appendChild(node)
    } else {
      startContainer.insertBefore(node, children[startOffset])
    }

    if (startContainer === endContainer) {
      endOffset += children.length - childCount
    }

    range.setStart(startContainer, startOffset)
    range.setEnd(endContainer, endOffset)
  },

  extractContentsOfRange: function(range, common) {
    var startContainer = range.startContainer,
      startOffset = range.startOffset,
      endContainer = range.endContainer,
      endOffset = range.endOffset

    if (!common) {
      common = range.commonAncestorContainer
    }

    if (common.nodeType === env.TEXT_NODE) {
      common = common.parentNode
    }

    var endNode = this.editor.dom.split(endContainer, endOffset, common),
      startNode = this.editor.dom.split(startContainer, startOffset, common),
      frag = common.ownerDocument.createDocumentFragment(),
      next, before, after

    // End node will be null if at end of child nodes list.
    while (startNode !== endNode) {
      next = startNode.nextSibling
      frag.appendChild(startNode)
      startNode = next
    }

    startContainer = common
    startOffset = endNode
      ? indexOf.call(common.childNodes, endNode)
      : common.childNodes.length

    // Merge text nodes if adjacent. IE10 in particular will not focus
    // between two text nodes
    after = common.childNodes[startOffset]
    before = after && after.previousSibling
    if (before
      && before.nodeType === env.TEXT_NODE
      && after.nodeType === env.TEXT_NODE) {
      startContainer = before
      startOffset = before.length
      before.appendData(after.data)
      this.editor.dom.detach(after)
    }

    range.setStart(startContainer, startOffset)
    range.collapse(true)

    this.editor.dom.fixCursor(common)

    return frag
  },

  deleteContentsOfRange: function(range) {
    // Move boundaries up as much as possible to reduce need to split.
    this.moveRangeBoundariesUpTree(range)

    // Remove selected range
    this.extractContentsOfRange(range)

    // Move boundaries back down tree so that they are inside the blocks.
    // If we don't do this, the range may be collapsed to a point between
    // two blocks, so get(Start|End)BlockOfRange will return null.
    this.moveRangeBoundariesDownTree(range)

    // If we split into two different blocks, merge the blocks.
    var startBlock = this.getStartBlockOfRange(range),
      endBlock = this.getEndBlockOfRange(range)
    if (startBlock && endBlock && startBlock !== endBlock) {
      this.editor.dom.mergeWithBlock(startBlock, endBlock, range)
    }

    // Ensure block has necessary children
    if (startBlock) {
      this.editor.dom.fixCursor(startBlock)
    }

    // Ensure body has a block-level element in it.
    var body = range.endContainer.ownerDocument.body,
      child = body.firstChild
    if (!child || child.nodeName === 'BR') {
      this.editor.dom.fixCursor(body)
      range.selectNodeContents(body.firstChild)
    }
  },

  insertTreeFragmentIntoRange: function(range, frag) {
    // Check if it's all inline content
    var allInline = true,
      children = frag.childNodes,
      l = children.length

    while (l--) {
      if (!this.editor.dom.isInline(children[l])) {
        allInline = false
        break
      }
    }

    // Delete any selected content
    if (!range.collapsed) {
      this.deleteContentsOfRange(range)
    }

    // Move range down into text nodes
    this.moveRangeBoundariesDownTree(range)

    // If inline, just insert at the current position.
    if (allInline) {
      this.insertNodeInRange(range, frag)
      range.collapse(false)
    }
    // Otherwise, split up to blockquote (if a parent) or body, insert inline
    // before and after split and insert block in between split, then merge
    // containers.
    else {
      var splitPoint = range.startContainer,
        nodeAfterSplit = this.editor.dom.split(splitPoint, range.startOffset,
          this.editor.dom.getNearest(splitPoint.parentNode, 'BLOCKQUOTE')
          || splitPoint.ownerDocument.body),
        nodeBeforeSplit = nodeAfterSplit.previousSibling,
        startContainer = nodeBeforeSplit,
        startOffset = startContainer.childNodes.length,
        endContainer = nodeAfterSplit,
        endOffset = 0,
        parent = nodeAfterSplit.parentNode,
        child, node

      while ((child = startContainer.lastChild)
        && child.nodeType === env.ELEMENT_NODE
        && child.nodeName !== 'BR') {
        startContainer = child
        startOffset = startContainer.childNodes.length
      }
      while ((child = endContainer.firstChild)
        && child.nodeType === env.ELEMENT_NODE
        && child.nodeName !== 'BR') {
        endContainer = child
      }
      while ((child = frag.firstChild) && this.editor.dom.isInline(child)) {
        startContainer.appendChild(child)
      }
      while ((child = frag.lastChild) && this.editor.dom.isInline(child)) {
        endContainer.insertBefore(child, endContainer.firstChild)
        endOffset += 1
      }

      // Fix cursor then insert block(s)
      node = frag
      while ((node = this.editor.dom.getNextBlock(node))) {
        this.editor.dom.fixCursor(node)
      }
      parent.insertBefore(frag, nodeAfterSplit)

      // Remove empty nodes created by split and merge inserted containers
      // with edges of split
      node = nodeAfterSplit.previousSibling
      if (!nodeAfterSplit.textContent) {
        parent.removeChild(nodeAfterSplit)
      } else {
        this.editor.dom.mergeContainers(nodeAfterSplit)
      }
      if (!nodeAfterSplit.parentNode) {
        endContainer = node
        endOffset = this.editor.dom.getLength(endContainer)
      }

      if (!nodeBeforeSplit.textContent) {
        startContainer = nodeBeforeSplit.nextSibling
        startOffset = 0
        parent.removeChild(nodeBeforeSplit)
      } else {
        this.editor.dom.mergeContainers(nodeBeforeSplit)
      }

      range.setStart(startContainer, startOffset)
      range.setEnd(endContainer, endOffset)
      this.moveRangeBoundariesDownTree(range)
    }
  },

  isNodeContainedInRange: function(range, node, partial) {
    var nodeRange = node.ownerDocument.createRange()

    nodeRange.selectNode(node)

    if (partial) {
      // Node must not finish before range starts or start after range
      // finishes.
      var nodeEndBeforeStart = (range.compareBoundaryPoints(
          END_TO_START, nodeRange) > -1),
        nodeStartAfterEnd = (range.compareBoundaryPoints(
          START_TO_END, nodeRange) < 1)
      return (!nodeEndBeforeStart && !nodeStartAfterEnd)
    } else {
      // Node must start after range starts and finish before range
      // finishes
      var nodeStartAfterStart = (range.compareBoundaryPoints(
          START_TO_START, nodeRange) < 1),
        nodeEndBeforeEnd = (range.compareBoundaryPoints(
          END_TO_END, nodeRange) > -1)
      return (nodeStartAfterStart && nodeEndBeforeEnd)
    }
  },

  moveRangeBoundariesDownTree: function(range) {
    var startContainer = range.startContainer,
      startOffset = range.startOffset,
      endContainer = range.endContainer,
      endOffset = range.endOffset,
      child

    while (startContainer.nodeType !== env.TEXT_NODE) {
      child = startContainer.childNodes[startOffset]
      if (!child || this.editor.dom.isLeaf(child)) {
        break
      }
      startContainer = child
      startOffset = 0
    }
    if (endOffset) {
      while (endContainer.nodeType !== env.TEXT_NODE) {
        child = endContainer.childNodes[endOffset - 1]
        if (!child || this.editor.dom.isLeaf(child)) {
          break
        }
        endContainer = child
        endOffset = this.editor.dom.getLength(endContainer)
      }
    } else {
      while (endContainer.nodeType !== env.TEXT_NODE) {
        child = endContainer.firstChild
        if (!child || this.editor.dom.isLeaf(child)) {
          break
        }
        endContainer = child
      }
    }

    // If collapsed, this algorithm finds the nearest text node positions
    // *outside* the range rather than inside, but also it flips which is
    // assigned to which.
    if (range.collapsed) {
      range.setStart(endContainer, endOffset)
      range.setEnd(startContainer, startOffset)
    } else {
      range.setStart(startContainer, startOffset)
      range.setEnd(endContainer, endOffset)
    }
  },

  moveRangeBoundariesUpTree: function(range, common) {
    var startContainer = range.startContainer,
      startOffset = range.startOffset,
      endContainer = range.endContainer,
      endOffset = range.endOffset,
      parent

    if (!common) {
      common = range.commonAncestorContainer
    }

    while (startContainer !== common && !startOffset) {
      parent = startContainer.parentNode
      startOffset = indexOf.call(parent.childNodes, startContainer)
      startContainer = parent
    }

    while (endContainer !== common
      && endOffset === this.editor.dom.getLength(endContainer)) {
      parent = endContainer.parentNode
      endOffset = indexOf.call(parent.childNodes, endContainer) + 1
      endContainer = parent
    }

    range.setStart(startContainer, startOffset)
    range.setEnd(endContainer, endOffset)
  },

  // Returns the first block at least partially contained by the range,
  // or null if no block is contained by the range.
  getStartBlockOfRange: function(range) {
    var container = range.startContainer,
      block

    // If inline, get the containing block.
    if (this.editor.dom.isInline(container)) {
      block = this.editor.dom.getPreviousBlock(container)
    } else if (this.editor.dom.isBlock(container)) {
      block = container
    } else {
      block = this.getNodeBefore(container, range.startOffset)
      block = this.editor.dom.getNextBlock(block)
    }
    // Check the block actually intersects the range
    return block && this.isNodeContainedInRange(range, block, true) ? block : null
  },

  // Returns the last block at least partially contained by the range,
  // or null if no block is contained by the range.
  getEndBlockOfRange: function(range) {
    var container = range.endContainer,
      block, child

    // If inline, get the containing block.
    if (this.editor.dom.isInline(container)) {
      block = this.editor.dom.getPreviousBlock(container)
    } else if (this.editor.dom.isBlock(container)) {
      block = container
    } else {
      block = this.getNodeAfter(container, range.endOffset)
      if (!block) {
        block = container.ownerDocument.body
        while ((child = block.lastChild)) {
          block = child
        }
      }
      block = this.editor.dom.getPreviousBlock(block)
    }
    // Check the block actually intersects the range
    return block && this.isNodeContainedInRange(range, block, true) ? block : null
  },

  contentWalker: new TreeWalker(null,
    env.SHOW_TEXT | env.SHOW_ELEMENT,
    function(node) {
      return node.nodeType === env.TEXT_NODE
        ? env.notWS.test(node.data)
        : node.nodeName === 'IMG'
    }
  ),

  rangeDoesStartAtBlockBoundary: function(range) {
    var startContainer = range.startContainer,
      startOffset = range.startOffset

    // If in the middle or end of a text node, we're not at the boundary.
    if (startContainer.nodeType === env.TEXT_NODE) {
      if (startOffset) {
        return false
      }
      this.contentWalker.currentNode = startContainer
    } else {
      this.contentWalker.currentNode = this.getNodeAfter(startContainer, startOffset)
    }

    // Otherwise, look for any previous content in the same block.
    this.contentWalker.root = this.getStartBlockOfRange(range)

    return !this.contentWalker.previousNode()
  },

  rangeDoesEndAtBlockBoundary: function(range) {
    var endContainer = range.endContainer,
      endOffset = range.endOffset,
      length

    // If in a text node with content, and not at the end, we're not
    // at the boundary
    if (endContainer.nodeType === env.TEXT_NODE) {
      length = endContainer.data.length
      if (length && endOffset < length) {
        return false
      }
      this.contentWalker.currentNode = endContainer
    } else {
      this.contentWalker.currentNode = this.getNodeBefore(endContainer, endOffset)
    }

    // Otherwise, look for any further content in the same block.
    this.contentWalker.root = this.getEndBlockOfRange(range)

    return !this.contentWalker.nextNode()
  },

  expandRangeToBlockBoundaries: function(range) {
    var start = this.getStartBlockOfRange(range),
      end = this.getEndBlockOfRange(range),
      parent

    if (start && end) {
      parent = start.parentNode
      range.setStart(parent, indexOf.call(parent.childNodes, start))
      parent = end.parentNode
      range.setEnd(parent, indexOf.call(parent.childNodes, end) + 1)
    }
  }

}

module.exports = Range
