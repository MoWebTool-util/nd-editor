/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict';

module.exports = function() {
  var plugin = this,
    host = plugin.host;

  host.addButton({
    role: 'blockquote',
    action: 'indent',
    text: 'Increase Indent',
    group: 'layout',
    shortcut: 'ctrl+[ ctrl+]',
    handlers: function(e, d) {
      if (d.shortcut === 'ctrl+[' || d.action === 'indent') {
        d.editor.modifyBlocks(function(frag) {
          return this.createElement('BLOCKQUOTE', [
            frag
          ]);
        });
      } else if (d.shortcut === 'ctrl+]' || d.action === 'outdent') {
        d.editor.modifyBlocks(function(frag) {
          var blockquotes = frag.querySelectorAll('blockquote');

          Array.prototype.filter.call(blockquotes, function(el) {
            return !this.dom.getNearest(el.parentNode, 'BLOCKQUOTE');
          }, d.editor).forEach(function(el) {
            this.dom.replaceWith(el, this.dom.empty(el));
          }, d.editor);

          return frag;
        });
      }
    }
  });

  host.addButton({
    role: 'blockquote',
    action: 'outdent',
    text: 'Decrease Indent',
    group: 'layout'
  });

  host.on('viewChange', function(state) {
    host.enableButton('blockquote', state === 'wysiwyg');
  });

  // 通知就绪
  this.ready();
};
