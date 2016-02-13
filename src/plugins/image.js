/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict';

var __ = require('nd-i18n');
var debug = require('nd-debug');

var FormDialog = require('../modules/form-dialog');

module.exports = function() {
  var plugin = this,
    host = plugin.host;

  var dialog;

  var PER_SIZE = '100%';
  var cache = {};

  var server = host.get('server');

  if (!server) {
    debug.warn('Image uploader requires server.');
    return;
  }

  host.addButton({
    role: 'image',
    text: 'Image',
    group: 'richtext',
    handlers: function(e, d) {
      var editor = d.editor;
      // 2ac6061d-22c0-4925-91a2-50cfb8593bc2
      var url = '';
      var file = '';
      var size = 0;

      var cpath = editor.getPath().slice();
      var image;
      var match;

      while ((image = cpath.pop())) {
        if (image.nodeName === 'IMG') {

          if (!image.parentNode) {
            continue;
          }

          editor.selectNode(image);

          url = image.src;

          match = url.match(/\?dentryId=([-0-9a-f]+)/);
          if (match) {
            file = match[1];
          }

          match = url.match(/&size=(\d+)/);
          if (match) {
            size = +match[1];
          }

          break;
        }

        image = null;
      }

      function setImageSize() {
        var img = new Image();

        img.onload = function() {
          if (cache.size === PER_SIZE) {
            image.setAttribute('width', PER_SIZE);
          }else {
            image.setAttribute('height', img.height);
            image.setAttribute('width', img.width);
          }

          img.onload = null;
        };

        img.src = image.src;

        if (img.complete) {
          img.onload();
        }
      }

      var makeImage = function(data) {
        cache.size = data.size;
        data.size = +data.size;

        if (data.file) {
          data.url = server.download({
            value: data.file
          }, data.size ? {
            size: data.size
          } : null).src;
        }

        if (image) {
          image.src = data.url;
        } else {
          image = editor.createElement('IMG', {
            src: data.url
          });
          editor.insertElement(image);
        }

        image.setAttribute('data-src', data.file);

        setImageSize();

        dialog = null;

        return editor.focus();
      };

      var sizes = [PER_SIZE, 80, 120, 160, 240, 320, 480, 640, 960]
        .map(function(size) {
          return {
            text: size,
            value: size
          };
        });

      sizes.unshift({
        text: __('原图'),
        value: 0
      });

      var fields = [{
        name: 'size',
        label: __('图片尺寸'),
        type: 'select',
        options: sizes
      }, {
        label: __('本地文件'),
        name: 'file',
        type: 'file',
        attrs: {
          required: 'required',
          multiple: false,
          accept: '.gif,.jpg,.jpeg,.bmp,.png',
          title: __('图片文件'),
          swf: '/lib/uploader.swf'
        }
      }];

      dialog = new FormDialog({
          title: __('插入图片'),
          formData: {
            size: size,
            file: file
          },
          fields: fields,
          pluginCfg: {
            'Upload': [function() {
              this.setOptions('config', {
                server: server
              });
            }]
          }
        })
        .on('formCancel', function() {
          this.destroy();
        })
        .on('formSubmit', function(data) {
          makeImage(data);
          this.destroy();
        })
        .render();
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
