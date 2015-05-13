/**
 * @module: Editor
 * @author: crossjs <liwenfu@crossjs.com> - 2015-05-07 13:05:11
 */

'use strict';

module.exports = function() {
  var plugin = this,
    host = plugin.host;

  var inSource = false;
  var textarea;
  var valueCached;

  host.addButton({
    role: 'code',
    text: 'Source Code',
    group: 'tool',
    handlers: function(e, d) {
      if (!textarea) {
        textarea = host.$('.container > textarea');
      }

      host.trigger('viewChange', inSource ? 'wysiwyg' : 'source');

      if (inSource) {
        inSource = false;
        d.button.classList.remove('active');

        var value = textarea.val();

        if (value !== valueCached) {
          d.editor.setHTML(value);
        }

        textarea.hide().empty();
        return d.editor.focus();
      } else {
        inSource = true;
        d.button.classList.add('active');

        valueCached = d.editor.getHTML();

        return textarea.val(valueCached).show().focus();
      }
    }
  });

  // 通知就绪
  this.ready();
};
