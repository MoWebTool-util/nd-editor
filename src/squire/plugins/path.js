/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict';

module.exports = function() {
  var plugin = this,
    // host === editor
    host = plugin.host,
    env = host.env;

  var lastAnchor = null;
  var lastFocus = null;
  var currentPath = host.currentPath = [];

  function getPath(node) {
    var path = [];

    if (node.nodeName === 'BODY') {
      return path;
    }

    var parent = node.parentNode;

    if (parent) {
      if (parent.nodeName !== 'BODY') {
        // parent always be ELEMENT_NODE
        var _path = getPath(parent);

        if (_path.length) {
          path = _path.concat(path);
        }
      }

      if (node.nodeType === env.ELEMENT_NODE) {
        path.push(node);
      }
    }

    return path;
  }

  function update(force) {
    var range = host.range.getSelection(),
      selectedNode = host.getSelectedNode(range),
      anchor = selectedNode || range.startContainer,
      focus = selectedNode || range.endContainer;

    if (force || anchor !== lastAnchor || focus !== lastFocus) {

      lastAnchor = anchor;
      lastFocus = focus;

      currentPath = host.currentPath = anchor && focus &&
        getPath(anchor === focus ? focus : range.commonAncestorContainer) || [];

      host.trigger('pathChange', {
        path: currentPath
      });
    }

    if (!range.collapsed) {
      host.trigger('select');
    }
  }

  host.after('changeFormat', update);
  host.after('_setHTML', update);

  host.delegateEvents({
    'keyup': update,
    'mouseup': update
  });

  // 通知就绪
  this.ready();
};
