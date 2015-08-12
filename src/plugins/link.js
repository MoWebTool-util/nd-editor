/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict';

var FormDialog = require('../modules/form-dialog');

module.exports = function() {
  var plugin = this,
    host = plugin.host;

  var dialog;

  host.addButton({
    role: 'link',
    text: 'Link',
    group: 'richtext',
    handlers: function(e, d) {
      var editor = d.editor;
      var url = '';

      var cpath = editor.getPath().slice();
      var anchor;

      while ((anchor = cpath.pop())) {
        if (anchor.nodeName === 'A') {
          editor.selectNode(anchor);

          url = anchor.getAttribute('href');

          break;
        }

        anchor = null;
      }

      var makeLink = function(data) {
        var url = data.url;
        var range = editor.range.getSelection();

        if (!url) {
          editor.changeFormat(null, {
            tag: 'A'
          }, editor.range.getSelection(), true);
        } else {
          if (range.collapsed) {
            editor.range.insertNodeInRange(
              range,
              editor.getDocument().createTextNode(url)
            );
          }

          editor.changeFormat({
            tag: 'A',
            attributes: {
              href: url
            }
          }, {
            tag: 'A'
          }, range);
        }

        dialog = null;

        return editor.focus();
      };

      dialog = new FormDialog({
          title: '插入链接',
          formData: {
            url: url
          },
          fields: [{
            label: '链接',
            name: 'url',
            attrs: {
              placeholder: 'http://',
              required: 'required',
              autofocus: true
            }
          }]
        })
        .on('formCancel', function() {
          this.destroy();
        })
        .on('formSubmit', function() {
          var that = this;

          // 调用队列
          this.submit(function(data) {
            makeLink(data);
            that.destroy();
          });

          // 阻止默认事件发生
          return false;
        })
        .render();
    }
  });

  host.on('ready', function(editor) {
    editor.delegateEvents({
      'mousedown': function(e) {
        if (/^(?:IMG|AUDIO|VIDEO|HR)$/.test(e.target.nodeName)) {
          this.selectNode(e.target);
        }
      }
    });
  });

  host.before('destroy', function() {
    dialog && dialog.destroy();
  });

  host.on('viewChange', function(state) {
    host.enableButton('link', state === 'wysiwyg');
  });

  // 通知就绪
  this.ready();
};
