/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict';

module.exports = function() {
  var plugin = this,
    host = plugin.host;

  var filter = Array.prototype.filter;

  var makeList = function(frag, type) {
    var walker = this.dom.getBlockWalker(frag),
      node, tag, prev, newLi;

    while ((node = walker.nextNode())) {
      tag = node.parentNode.nodeName;
      if (tag !== 'LI') {
        newLi = this.createElement('LI', {
          'class': node.dir === 'rtl' ? 'dir-rtl' : undefined,
          dir: node.dir || undefined
        });
        // Have we replaced the previous block with a new <ul>/<ol>?
        if ((prev = node.previousSibling) &&
          prev.nodeName === type) {
          prev.appendChild(newLi);
        }
        // Otherwise, replace this block with the <ul>/<ol>
        else {
          this.dom.replaceWith(
            node,
            this.createElement(type, [
              newLi
            ])
          );
        }
        newLi.appendChild(node);
      } else {
        node = node.parentNode.parentNode;
        tag = node.nodeName;
        if (tag !== type && (/^[OU]L$/.test(tag))) {
          this.dom.replaceWith(node,
            this.createElement(type, [this.dom.empty(node)])
          );
        }
      }
    }
  };

  host.addButton({
    role: 'orderedlist',
    text: 'Ordered List',
    group: 'layout',
    // shortcut: 'ctrl+shift+8',
    handlers: function(e, d) {
      d.editor.modifyBlocks(function(frag) {
        makeList.call(d.editor, frag, 'OL');
        return frag;
      });
    }
  });

  host.addButton({
    role: 'unorderedlist',
    text: 'Unordered List',
    group: 'layout',
    // shortcut: 'ctrl+shift+9',
    handlers: function(e, d) {
      d.editor.modifyBlocks(function(frag) {
        makeList.call(d.editor, frag, 'UL');
        return frag;
      });
    }
  });

  host.on('viewChange', function(state) {
    host.enableButton('orderedlist', state === 'wysiwyg');
    host.enableButton('unorderedlist', state === 'wysiwyg');
  });

  host.addShortcut('tab', function(e, d) {
    var node, parent;
    var editor = d.editor, range = d.range;
    editor._removeZWS();

    function increaseListLevel(frag) {
      var items = frag.querySelectorAll('LI'),
        i, l, item,
        type, newParent;
      for (i = 0, l = items.length; i < l; i += 1) {
        item = items[i];
        if (!editor.dom.isContainer(item.firstChild)) {
          // type => 'UL' or 'OL'
          type = item.parentNode.nodeName;
          newParent = item.previousSibling;
          if (!newParent || !(newParent = newParent.lastChild) ||
            newParent.nodeName !== type) {
            editor.dom.replaceWith(
              item,
              editor.createElement('LI', [
                newParent = editor.createElement(type)
              ])
            );
          }
          newParent.appendChild(item);
        }
      }
      return frag;
    }

    // If no selection and in an empty block
    if (range.collapsed &&
      editor.range.rangeDoesStartAtBlockBoundary(range) &&
      editor.range.rangeDoesEndAtBlockBoundary(range)) {
      node = editor.range.getStartBlockOfRange(range);

      // Iterate through the block's parents
      while ((parent = node.parentNode)) {
        // If we find a UL or OL (so are in a list, node must be an LI)
        if (parent.nodeName === 'UL' || parent.nodeName === 'OL') {
          // AND the LI is not the first in the list
          if (node.previousSibling) {
            // Then increase the list level
            // e.preventDefault();
            editor.modifyBlocks(increaseListLevel, range);
          }

          break;
        }

        node = parent;
      }

      e.preventDefault();
    }
  });

  host.addShortcut('shift+tab', function(e, d) {
    var editor = d.editor, range = d.range;

    editor._removeZWS();

    var decreaseListLevel = function(frag) {
      var items = frag.querySelectorAll('LI');

      filter.call(items, function(el) {
        return !editor.dom.isContainer(el.firstChild);
      }).forEach(function(item) {
        var parent = item.parentNode,
          newParent = parent.parentNode,
          first = item.firstChild,
          node = first,
          next;
        if (item.previousSibling) {
          parent = editor.dom.split(parent, item, newParent);
        }
        while (node) {
          next = node.nextSibling;
          if (editor.dom.isContainer(node)) {
            break;
          }
          newParent.insertBefore(node, parent);
          node = next;
        }
        if (newParent.nodeName === 'LI' && first.previousSibling) {
          editor.dom.split(newParent, first, newParent.parentNode);
        }
        while (item !== frag && !item.childNodes.length) {
          parent = item.parentNode;
          parent.removeChild(item);
          item = parent;
        }
      });

      editor.dom.fixContainer(frag);

      return frag;
    };

    var block = editor.range.getStartBlockOfRange(range);

    // If no selection and in an empty block
    if (editor.dom.getNearest(block, 'UL') || editor.dom.getNearest(block, 'OL')) {
      e.preventDefault();
      editor.modifyBlocks(decreaseListLevel, range);
    }
  });

  // 通知就绪
  this.ready();
};
