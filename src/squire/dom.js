'use strict';

var env = require('./env');
var TreeWalker = require('./tree-walker');

var DOM = function(editor) {
  this.editor = editor;
  this.defaultBlockTag = editor.get('defaultBlockTag');
  this.defaultBlockProperties = editor.get('defaultBlockProperties');
};

DOM.prototype = {

  constructor: DOM,

  every: function(nodeList, fn) {
    var l = nodeList.length;

    while (l--) {
      if (!fn(nodeList[l])) {
        return false;
      }
    }

    return true;
  },

  hasTagAttributes: function(node, tag, attributes) {
    if (tag !== '*' && node.nodeName !== tag) {
      return false;
    }

    for (var attr in attributes) {
      var nodeAttr = node.getAttribute(attr);
      var wishAttr = attributes[attr];

      if (wishAttr !== '*' && nodeAttr !== wishAttr) {
        return false;
      }
    }

    return true;
  },

  areAlike: function(node, node2) {
    return (
      node.nodeType === node2.nodeType &&
      node.nodeName === node2.nodeName &&
      node.className === node2.className &&
      ((!node.style && !node2.style) ||
        node.style.cssText === node2.style.cssText)
    );
  },

  isLeaf: function(node) {
    return node.nodeType === env.ELEMENT_NODE &&
      !!env.LEAF_NODE_NAMES[node.nodeName];
  },

  isInline: function(node) {
    return env.INLINE_NODE_NAMES.test(node.nodeName);
  },

  isBlock: function(node) {
    return node.nodeType === env.ELEMENT_NODE &&
      !this.isInline(node) && this.every(node.childNodes, this.isInline);
  },

  isContainer: function(node) {
    return node.nodeType === env.ELEMENT_NODE &&
      !this.isInline(node) && !this.isBlock(node);
  },

  getBlockWalker: function(node) {
    var walker = new TreeWalker(
        this.editor.getBody(),
        env.SHOW_ELEMENT,
        this.isBlock.bind(this),
        false
      );

    walker.currentNode = node;

    return walker;
  },

  getPreviousBlock: function(node) {
    return this.getBlockWalker(node).previousNode();
  },

  getNextBlock: function(node) {
    return this.getBlockWalker(node).nextNode();
  },

  getNearest: function(node, tag, attributes) {
    do {
      if (this.hasTagAttributes(node, tag, attributes)) {
        return node;
      }
    } while ((node = node.parentNode));

    return null;
  },

  getLength: function(node) {
    var nodeType = node.nodeType;

    return nodeType === env.ELEMENT_NODE ?
      node.childNodes.length : node.length || 0;
  },

  detach: function(node) {
    var parent = node.parentNode;
    if (parent) {
      parent.removeChild(node);
    }
    return node;
  },

  replaceWith: function(node, node2) {
    var parent = node.parentNode;
    if (parent) {
      parent.replaceChild(node2, node);
    }
  },

  empty: function(node) {
    var frag = node.ownerDocument.createDocumentFragment(),
      childNodes = node.childNodes,
      l = childNodes ? childNodes.length : 0;
    while (l--) {
      frag.appendChild(node.firstChild);
    }
    return frag;
  },

  /*jshint maxparams:4*/
  createElement: function(tag, attributes, children) {
    var el = this.editor.getDocument().createElement(tag),
      attr, value, i, l;

    if (attributes instanceof Array) {
      children = attributes;
      attributes = null;
    }

    if (attributes) {
      for (attr in attributes) {
        value = attributes[attr];
        if (value !== undefined) {
          el.setAttribute(attr, attributes[attr]);
        }
      }
    }

    if (children) {
      for (i = 0, l = children.length; i < l; i += 1) {
        el.appendChild(children[i]);
      }
    }

    return el;
  },

  createDefaultBlock: function(children) {
    return this.fixCursor(
      this.createElement(
        this.defaultBlockTag,
        this.defaultBlockProperties,
        children)
    );
  },

  createTextNode: function(text) {
    return this.editor.getDocument().createTextNode(text);
  },

  fixCursor: function(node) {
    // In Webkit and Gecko, block level elements are collapsed and
    // unfocussable if they have no content. To remedy this, a <BR> must be
    // inserted. In Opera and IE, we just need a textnode in order for the
    // cursor to appear.
    var doc = this.editor.getDocument(),
      root = node,
      fixer, child;

    if (node.nodeName === 'BODY') {
      if (!(child = node.firstChild) || child.nodeName === 'BR') {
        fixer = this.createDefaultBlock();

        if (child) {
          node.replaceChild(fixer, child);
        } else {
          node.appendChild(fixer);
        }

        node = fixer;
        fixer = null;
      }
    }

    if (this.isInline(node)) {
      child = node.firstChild;
      while (env.cantFocusEmptyTextNodes && child &&
        child.nodeType === env.TEXT_NODE && !child.data) {
        node.removeChild(child);
        child = node.firstChild;
      }
      if (!child) {
        if (env.cantFocusEmptyTextNodes) {
          fixer = doc.createTextNode(env.ZWS);
          this.editor._didAddZWS();
        } else {
          fixer = doc.createTextNode('');
        }
      }
    } else {
      if (env.useTextFixer) {
        while (node.nodeType !== env.TEXT_NODE && !this.isLeaf(node)) {
          child = node.firstChild;

          if (!child) {
            fixer = doc.createTextNode('');
            break;
          }

          node = child;
        }
        if (node.nodeType === env.TEXT_NODE) {
          // Opera will collapse the block element if it contains
          // just spaces (but not if it contains no data at all).
          if (/^ +$/.test(node.data)) {
            node.data = '';
          }
        } else if (this.isLeaf(node)) {
          node.parentNode.insertBefore(doc.createTextNode(''), node);
        }
      } else if (!node.querySelector('BR')) {
        while ((child = node.lastElementChild) && !this.isInline(child)) {
          node = child;
        }
        // BR will be append to empty nodes
        if (!node.firstChild || node.textContent === '') {
          // BR make IE 10 double line-height
          fixer = this.createElement('BR');
          // fixer = doc.createTextNode(env.ZWS);
        }
      }
    }
    if (fixer) {
      node.appendChild(fixer);
    }

    return root;
  },

  // Recursively examine container nodes and wrap any inline children.
  fixContainer: function(container) {
    var children = container.childNodes,
      wrapper = null,
      i, l, child, isBR;

    for (i = 0, l = children.length; i < l; i += 1) {
      child = children[i];
      isBR = child.nodeName === 'BR';

      if (!isBR && this.isInline(child)) {
        if (!wrapper) {
          wrapper = this.createElement('DIV');
        }

        wrapper.appendChild(child);

        i -= 1;
        l -= 1;

      } else if (isBR || wrapper) {

        if (!wrapper) {
          wrapper = this.createElement('DIV');
        }

        this.fixCursor(wrapper);

        if (isBR) {
          container.replaceChild(wrapper, child);
        } else {
          container.insertBefore(wrapper, child);
          i += 1;
          l += 1;
        }

        wrapper = null;
      }

      if (this.isContainer(child)) {
        this.fixContainer(child);
      }
    }

    if (wrapper) {
      container.appendChild(this.fixCursor(wrapper));
    }

    return container;
  },

  split: function(node, offset, stopNode) {
    var nodeType = node.nodeType,
      parent, clone, next;
    if (nodeType === env.TEXT_NODE && node !== stopNode) {
      return this.split(node.parentNode, node.splitText(offset), stopNode);
    }
    if (nodeType === env.ELEMENT_NODE) {
      if (typeof(offset) === 'number') {
        offset = offset < node.childNodes.length ?
          node.childNodes[offset] : null;
      }
      if (node === stopNode) {
        return offset;
      }

      // Clone node without children
      parent = node.parentNode;
      clone = node.cloneNode(false);

      // Add right-hand siblings to the clone
      while (offset) {
        next = offset.nextSibling;
        clone.appendChild(offset);
        offset = next;
      }

      // Maintain li numbering if inside a quote.
      if (node.nodeName === 'OL' && this.getNearest(node, 'BLOCKQUOTE')) {
        clone.start = (+node.start || 1) + node.childNodes.length - 1;
      }

      // DO NOT NORMALISE. This may undo the fixCursor() call
      // of a node lower down the tree!

      // We need something in the element in order for the cursor to appear.
      this.fixCursor(node);
      this.fixCursor(clone);

      // Inject clone after original node
      if ((next = node.nextSibling)) {
        parent.insertBefore(clone, next);
      } else {
        parent.appendChild(clone);
      }

      // Keep on splitting up the tree
      return this.split(parent, clone, stopNode);
    }
    return offset;
  },

  mergeInlines: function(node, range) {
    if (node.nodeType !== env.ELEMENT_NODE) {
      return;
    }
    var children = node.childNodes,
      l = children.length,
      frags = [],
      child, prev, len;
    while (l--) {
      child = children[l];
      prev = l && children[l - 1];
      if (l && this.isInline(child) && this.areAlike(child, prev) &&
        !env.LEAF_NODE_NAMES[child.nodeName]) {
        if (range.startContainer === child) {
          range.startContainer = prev;
          range.startOffset += this.getLength(prev);
        }
        if (range.endContainer === child) {
          range.endContainer = prev;
          range.endOffset += this.getLength(prev);
        }
        if (range.startContainer === node) {
          if (range.startOffset > l) {
            range.startOffset -= 1;
          } else if (range.startOffset === l) {
            range.startContainer = prev;
            range.startOffset = this.getLength(prev);
          }
        }
        if (range.endContainer === node) {
          if (range.endOffset > l) {
            range.endOffset -= 1;
          } else if (range.endOffset === l) {
            range.endContainer = prev;
            range.endOffset = this.getLength(prev);
          }
        }
        this.detach(child);
        if (child.nodeType === env.TEXT_NODE) {
          prev.appendData(child.data);
        } else {
          frags.push(this.empty(child));
        }
      } else if (child.nodeType === env.ELEMENT_NODE) {
        len = frags.length;
        while (len--) {
          child.appendChild(frags.pop());
        }
        this.mergeInlines(child, range);
      }
    }
  },

  mergeWithBlock: function(block, next, range) {
    var container = next,
      last, offset, _range;
    while (container.parentNode.childNodes.length === 1) {
      container = container.parentNode;
    }
    this.detach(container);

    offset = block.childNodes.length;

    // Remove extra <BR> fixer if present.
    last = block.lastChild;
    if (last && last.nodeName === 'BR') {
      block.removeChild(last);
      offset -= 1;
    }

    _range = {
      startContainer: block,
      startOffset: offset,
      endContainer: block,
      endOffset: offset
    };

    block.appendChild(this.empty(next));
    this.mergeInlines(block, _range);

    range.setStart(_range.startContainer, _range.startOffset);
    range.collapse(true);

    // Opera inserts a BR if you delete the last piece of text
    // in a block-level element. Unfortunately, it then gets
    // confused when setting the selection subsequently and
    // refuses to accept the range that finishes just before the
    // BR. Removing the BR fixes the bug.
    // Steps to reproduce bug: Type "a-b-c" (where - is return)
    // then backspace twice. The cursor goes to the top instead
    // of after "b".
    if (env.isPresto && (last = block.lastChild) && last.nodeName === 'BR') {
      block.removeChild(last);
    }
  },

  mergeContainers: function(node) {
    var prev = node.previousSibling,
      first = node.firstChild,
      isListItem = (node.nodeName === 'LI'),
      needsFix, block;

    // Do not merge LIs, unless it only contains a UL
    if (isListItem && (!first || !/^[OU]L$/.test(first.nodeName))) {
      return;
    }

    if (prev && this.areAlike(prev, node)) {
      if (!this.isContainer(prev)) {
        if (isListItem) {
          block = this.createElement('DIV');
          block.appendChild(this.empty(prev));
          prev.appendChild(block);
        } else {
          return;
        }
      }
      this.detach(node);
      needsFix = !this.isContainer(node);
      prev.appendChild(this.empty(node));
      if (needsFix) {
        this.fixContainer(prev);
      }
      if (first) {
        this.mergeContainers(first);
      }
    } else if (isListItem) {
      prev = this.createElement('DIV');
      node.insertBefore(prev, first);
      this.fixCursor(prev);
    }
  }

};

module.exports = DOM;
