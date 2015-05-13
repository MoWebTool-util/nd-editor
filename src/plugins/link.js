/**
 * @module: Editor
 * @author: crossjs <liwenfu@crossjs.com> - 2015-05-07 13:05:11
 */

'use strict';

var DialogForm = require('../modules/dialog-form');

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
      var url = 'http://';

      // if (editor.hasFormat('A')) {
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
      // }

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

      dialog = new DialogForm({
        title: '插入链接',
        formAttrs: {
          formData: {
            url: url
          },
          fields: [{
            label: '链接',
            name: 'url',
            attrs: {
              placeholder: 'URL',
              autofocus: true
            }
          }]
        },
        callback: makeLink
      }).show();
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


// link: function(url, attributes) {
//   var range = this.range.getSelection();
//   if (range.collapsed) {
//     var protocolEnd = url.indexOf(':') + 1;
//     if (protocolEnd) {
//       while (url[protocolEnd] === '/') {
//         protocolEnd += 1;
//       }
//     }
//     this.range.insertNodeInRange(
//       range,
//       this.getDocument().createTextNode(url.slice(protocolEnd))
//     );
//   }

//   if (!attributes) {
//     attributes = {};
//   }
//   attributes.href = url;

//   this.changeFormat({
//     tag: 'A',
//     attributes: attributes
//   }, {
//     tag: 'A'
//   }, range);

//   return this.focus();
// },

// unlink: function() {
//   this.changeFormat(null, {
//     tag: 'A'
//   }, this.range.getSelection(), true);
//   return this.focus();
// },
