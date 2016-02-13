/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict';

module.exports = function() {
  var plugin = this,
    host = plugin.host;

  var filter = Array.prototype.filter;

  var splitBlock = function(block, node, offset) {
    var tagAfterSplit = {
      DT: 'DD',
      DD: 'DT',
      LI: 'LI'
    };

    var splitTag = tagAfterSplit[block.nodeName],
      splitProperties = null,
      nodeAfterSplit = this.dom.split(node, offset, block.parentNode);

    if (!splitTag) {
      splitTag = this.get('defaultBlockTag');
      splitProperties = this.get('defaultBlockProperties');
    }

    // Make sure the new node is the correct type.
    if (!this.dom.hasTagAttributes(nodeAfterSplit, splitTag, splitProperties)) {
      block = this.dom.createElement(splitTag, splitProperties);

      if (nodeAfterSplit.dir) {
        block.className = nodeAfterSplit.dir === 'rtl' ? 'dir-rtl' : '';
        block.dir = nodeAfterSplit.dir;
      }

      this.dom.replaceWith(nodeAfterSplit, block);
      block.appendChild(this.dom.empty(nodeAfterSplit));
      nodeAfterSplit = block;
    }
    return nodeAfterSplit;
  };

  // If you delete the content inside a span with a font styling, Webkit will
  // replace it with a <font> tag (!). If you delete all the text inside a
  // link in Opera, it won't delete the link. Let's make things consistent. If
  // you delete all text inside an inline tag, remove the inline tag.
  var afterDelete = function(editor, range) {
    try {
      if (!range) {
        range = editor.range.getSelection();
      }
      var node = range.startContainer,
        parent;
      // Climb the tree from the focus point while we are inside an empty
      // inline element
      if (node.nodeType === editor.env.TEXT_NODE) {
        node = node.parentNode;
      }
      parent = node;
      while (editor.dom.isInline(parent) &&
        (!parent.textContent || parent.textContent === editor.env.ZWS)) {
        node = parent;
        parent = node.parentNode;
      }
      // If focussed in empty inline element
      if (node !== parent) {
        // Move focus to just before empty inline(s)
        range.setStart(parent,
          editor.env.indexOf.call(parent.childNodes, node));
        range.collapse(true);
        // Remove empty inline(s)
        parent.removeChild(node);
        // Fix cursor in block
        if (!editor.dom.isBlock(parent)) {
          parent = editor.dom.getPreviousBlock(parent);
        }
        editor.dom.fixCursor(parent);
        // Move cursor into text node
        editor.range.moveRangeBoundariesDownTree(range);
      }
      editor._ensureBottomLine();
      editor.range.setSelection(range);
      // editor.path.update(range, true);
    } catch (error) {
      editor.didError(error);
    }
  };

  var decreaseListLevel = function(frag) {
    var items = frag.querySelectorAll('LI');

    filter.call(items, function(el) {
      return !this.dom.isContainer(el.firstChild);
    }, this).forEach(function(item) {
      var parent = item.parentNode,
        newParent = parent.parentNode,
        first = item.firstChild,
        node = first,
        next;
      if (item.previousSibling) {
        parent = this.dom.split(parent, item, newParent);
      }
      while (node) {
        next = node.nextSibling;
        if (this.dom.isContainer(node)) {
          break;
        }
        newParent.insertBefore(node, parent);
        node = next;
      }
      if (newParent.nodeName === 'LI' && first.previousSibling) {
        this.dom.split(newParent, first, newParent.parentNode);
      }
      while (item !== frag && !item.childNodes.length) {
        parent = item.parentNode;
        parent.removeChild(item);
        item = parent;
      }
    }, this);

    this.dom.fixContainer(frag);

    return frag;
  };

  var removeBlockQuote = function( /* frag */ ) {
    return this.dom.createDefaultBlock([

      this.createElement('INPUT', {
        id: this.env.START_SELECTION_ID,
        type: 'hidden'
      }),

      this.createElement('INPUT', {
        id: this.env.END_SELECTION_ID,
        type: 'hidden'
      })

    ]);
  };

  var keyHandlers = {
    enter: function(e, d) {
      var block, parent, nodeAfterSplit;
      var editor = d.editor,
        range = d.range;

      // We handle this ourselves
      e.preventDefault();

      // Save undo checkpoint and add any links in the preceding section.
      // Remove any zws so we don't think there's content in an empty
      // block.
      // editor.undo.record(range);
      editor.addLinks(range.startContainer);
      editor._removeZWS();
      editor._getRangeAndRemoveBookmark(range, true);

      // Selected text is overwritten, therefore delete the contents
      // to collapse selection.
      if (!range.collapsed) {
        editor.range.deleteContentsOfRange(range);
      }

      block = editor.range.getStartBlockOfRange(range);

      // If this is a malformed bit of document or in a table;
      // just play it safe and insert a <br>.
      if (!block || /^T[HD]$/.test(block.nodeName)) {
        editor.range.insertNodeInRange(range, editor.createElement('BR'));
        range.collapse(false);
        editor.range.setSelection(range);
        // editor.path.update(range, true);
        return;
      }

      // If in a list, we'll split the LI instead.
      if ((parent = editor.dom.getNearest(block, 'LI'))) {
        block = parent;
      }

      if (!block.textContent) {
        // Break list
        if (editor.dom.getNearest(block, 'UL') || editor.dom.getNearest(block, 'OL')) {
          return editor.modifyBlocks(decreaseListLevel.bind(editor), range);
        }
        // Break blockquote
        else if (editor.dom.getNearest(block, 'BLOCKQUOTE')) {
          return editor.modifyBlocks(removeBlockQuote.bind(editor), range);
        }
      }

      // Otherwise, split at cursor point.
      nodeAfterSplit = splitBlock.call(editor, block,
        range.startContainer, range.startOffset);

      // Clean up any empty inlines if we hit enter at the beginning of the
      // block
      editor.removeZWS(block);
      editor.removeEmptyInlines(block);
      editor.dom.fixCursor(block);

      // Focus cursor
      // If there's a <b>/<i> etc. at the beginning of the split
      // make sure we focus inside it.
      while (nodeAfterSplit.nodeType === editor.env.ELEMENT_NODE) {
        var child = nodeAfterSplit.firstChild,
          next;

        // Don't continue links over a block break; unlikely to be the
        // desired outcome.
        if (nodeAfterSplit.nodeName === 'A' &&
          (!nodeAfterSplit.textContent ||
            nodeAfterSplit.textContent === editor.env.ZWS)) {
          child = editor.getDocument().createTextNode('');
          editor.dom.replaceWith(nodeAfterSplit, child);
          nodeAfterSplit = child;
          break;
        }

        while (child && child.nodeType === editor.env.TEXT_NODE && !child.data) {
          next = child.nextSibling;
          if (!next || next.nodeName === 'BR') {
            break;
          }
          editor.dom.detach(child);
          child = next;
        }

        // 'BR's essentially don't count; they're a browser hack.
        // If you try to select the contents of a 'BR', FF will not let
        // you type anything!
        if (!child || child.nodeName === 'BR' ||
          (child.nodeType === editor.env.TEXT_NODE && !editor.env.isPresto)) {
          break;
        }

        nodeAfterSplit = child;
      }

      range = editor.range.create(nodeAfterSplit, 0);
      editor.range.setSelection(range);
      // editor.path.update(range, true);

      // Scroll into view
      if (nodeAfterSplit.nodeType === editor.env.TEXT_NODE) {
        nodeAfterSplit = nodeAfterSplit.parentNode;
      }

      var doc = editor.getDocument(),
        body = editor.getBody();

      if (nodeAfterSplit.offsetTop + nodeAfterSplit.offsetHeight >
        (doc.documentElement.scrollTop || body.scrollTop) +
        body.offsetHeight) {
        nodeAfterSplit.scrollIntoView(false);
      }
    },
    backspace: function(e, d) {
      var editor = d.editor,
        range = d.range;

      editor._removeZWS();
      // Record undo checkpoint.
      // editor.undo.record(range);
      editor._getRangeAndRemoveBookmark(range, true);
      // If not collapsed, delete contents
      if (!range.collapsed) {
        e.preventDefault();
        editor.range.deleteContentsOfRange(range);
        afterDelete(editor, range);
      }
      // If at beginning of block, merge with previous
      else if (editor.range.rangeDoesStartAtBlockBoundary(range)) {
        e.preventDefault();
        var current = editor.range.getStartBlockOfRange(range),
          previous = current && editor.dom.getPreviousBlock(current);
        // Must not be at the very beginning of the text area.
        if (previous) {
          // If not editable, just delete whole block.
          if (!previous.isContentEditable) {
            editor.dom.detach(previous);
            return;
          }
          // Otherwise merge.
          editor.dom.mergeWithBlock(previous, current, range);
          // If deleted line between containers, merge newly adjacent
          // containers.
          current = previous.parentNode;
          while (current && !current.nextSibling) {
            current = current.parentNode;
          }
          if (current && (current = current.nextSibling)) {
            editor.dom.mergeContainers(current);
          }
          editor.range.setSelection(range);
        }
        // If at very beginning of text area, allow backspace
        // to break lists/blockquote.
        else if (current) {
          // Break list
          if (editor.dom.getNearest(current, 'UL') ||
            editor.dom.getNearest(current, 'OL')) {
            return editor.modifyBlocks(decreaseListLevel.bind(editor), range);
          }
          // Break blockquote
          else if (editor.dom.getNearest(current, 'BLOCKQUOTE')) {
            return editor.modifyBlocks(editor.decreaseBlockQuoteLevel, range);
          }
          editor.range.setSelection(range);
          // editor.path.update(range, true);
        }
      }
      // Otherwise, leave to browser but check afterwards whether it has
      // left behind an empty inline tag.
      else {
        editor.range.setSelection(range);
        setTimeout(afterDelete, 0, editor, range);
      }
    },
    'delete': function(e, d) {
      var editor = d.editor,
        range = d.range;

      editor._removeZWS();
      // Record undo checkpoint.
      // editor.undo.record(range);
      editor._getRangeAndRemoveBookmark(range, true);
      // If not collapsed, delete contents
      if (!range.collapsed) {
        e.preventDefault();
        editor.range.deleteContentsOfRange(range);
        afterDelete(editor, range);
      }
      // If at end of block, merge next into this block
      else if (editor.range.rangeDoesEndAtBlockBoundary(range)) {
        e.preventDefault();
        var current = editor.range.getStartBlockOfRange(range),
          next = current && editor.dom.getNextBlock(current);
        // Must not be at the very end of the text area.
        if (next) {
          // If not editable, just delete whole block.
          if (!next.isContentEditable) {
            editor.dom.detach(next);
            return;
          }
          // Otherwise merge.
          editor.dom.mergeWithBlock(current, next, range);
          // If deleted line between containers, merge newly adjacent
          // containers.
          next = current.parentNode;
          while (next && !next.nextSibling) {
            next = next.parentNode;
          }
          if (next && (next = next.nextSibling)) {
            editor.dom.mergeContainers(next);
          }
          editor.range.setSelection(range);
          // editor.path.update(range, true);
        }
      }
      // Otherwise, leave to browser but check afterwards whether it has
      // left behind an empty inline tag.
      else {
        editor.range.setSelection(range);
        setTimeout(afterDelete, 0, editor, range);
      }
    },
    space: function(e, d) {
      var node, parent;
      var editor = d.editor,
        range = d.range;

      // editor.undo.record(range);
      editor.addLinks(range.startContainer);
      editor._getRangeAndRemoveBookmark(range, true);

      // If the cursor is at the end of a link (<a>foo|</a>) then move it
      // outside of the link (<a>foo</a>|) so that the space is not part of
      // the link text.
      node = range.endContainer;
      parent = node.parentNode;

      if (range.collapsed && parent.nodeName === 'A' &&
        !node.nextSibling && range.endOffset === editor.dom.getLength(node)) {
        range.setStartAfter(parent);
      }

      editor.range.setSelection(range);
    },
    left: function(e, d) {
      d.editor._removeZWS();
    },
    right: function(e, d) {
      d.editor._removeZWS();
    }
  };

  // Firefox incorrectly handles Cmd-left/Cmd-right on Mac:
  // it goes back/forward in history! Override to do the right
  // thing.
  // https://bugzilla.mozilla.org/show_bug.cgi?id=289384
  if (host.env.isMac && host.env.isGecko && host.range.selection.modify) {
    keyHandlers['ctrl-left'] = function(e/*, d*/) {
      e.preventDefault();
      host.range.selection.modify('move', 'backward', 'lineboundary');
    };
    keyHandlers['ctrl-right'] = function(e/*, d*/) {
      e.preventDefault();
      host.range.selection.modify('move', 'forward', 'lineboundary');
    };
  }

  Object.keys(keyHandlers).forEach(function(key) {
    host.addKeyHandler(key, keyHandlers[key]);
  });

  keyHandlers = null;

  // 通知就绪
  this.ready();
};

// removeList: command('modifyBlocks', removeList),
