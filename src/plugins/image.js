/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict';

var DialogForm = require('../modules/dialog-form');

module.exports = function() {
  var plugin = this,
    host = plugin.host;

  var dialog;

  host.addButton({
    role: 'image',
    text: 'Image',
    group: 'richtext',
    handlers: function(e, d) {
      var editor = d.editor;
      // 2ac6061d-22c0-4925-91a2-50cfb8593bc2
      var url = '';

      var cpath = editor.getPath().slice();
      var image;

      while ((image = cpath.pop())) {
        if (image.nodeName === 'IMG') {
          editor.selectNode(image);

          url = image.src;

          break;
        }

        image = null;
      }

      var makeImage = function(data) {
        var url = data.file || data.url;

        if (image) {
          image.src = url;
        } else {
          image = editor.createElement('IMG', {
            src: url
          });
          editor.insertElement(image);
        }

        dialog = null;

        return editor.focus();
      };

      dialog = new DialogForm({
        title: '插入图片',
        formAttrs: {
          proxy: host.get('proxy'),
          formData: {
            url: url
          },
          fields: [{
            label: '地址',
            name: 'url',
            attrs: {
              // required: 'required'
            }
          }, {
            label: '上传',
            name: 'file',
            type: 'file',
            attrs: {
              // required: 'required',
              multiple: false,
              // accept: 'image/*'
              accept: '.gif,.jpg,.jpeg,.bmp,.png',
              // 最多文件数
              // maxcount: 3,
              // 单个最大字节数
              // maxbytes: 5 * 1024 * 1024,
              // 用于类型提示
              title: '图片文件',
              server: host.get('uploadServer'),
              swf: '/static/lib/uploader.swf',
              // 返回完整地址，而不是默认的 dentryId
              realpath: true
            }
          }]
        },
        callback: makeImage
      }).show();
    }
  });

  host.ready(function(editor) {
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
    host.enableButton('image', state === 'wysiwyg');
  });

  // 通知就绪
  this.ready();
};

// video: function(sources) {
//   var children = JSON.parse(sources).map(function(source) {
//     return this.createElement('SOURCE', source);
//   }, this);

//   var video = this.createElement('VIDEO', {
//     controls: 'controls',
//     width: 320,
//     height: 240
//   }, children);

//   var placeholder = this.createElement('IMG', {
//     'data-editor-html': video.outerHTML,
//     'data-editor-object': 'video',
//     src: env.TRANSPARENT_GIF,
//     'class': 'editor-object editor-objec-video',
//     width: 320,
//     height: 240
//   });

//   this.insertElement(placeholder);

//   return placeholder;
// },

// audio: function(sources) {
//   var children = JSON.parse(sources).map(function(source) {
//     return this.createElement('SOURCE', source);
//   }, this);

//   var audio = this.createElement('AUDIO', {
//     controls: 'controls',
//     width: 320,
//     height: 240
//   }, children);

//   var placeholder = this.createElement('IMG', {
//     'data-editor-html': audio.outerHTML,
//     'data-editor-object': 'audio',
//     src: env.TRANSPARENT_GIF,
//     'class': 'editor-object editor-objec-audio',
//     width: 320,
//     height: 240
//   });

//   this.insertElement(placeholder);

//   return placeholder;
// },
