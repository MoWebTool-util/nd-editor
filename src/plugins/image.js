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

      var server = host.get('server');

      var makeImage = function(data) {
        var size;

        if (data.width && !isNaN(data.width)) {
          size = +data.width;
        }

        if (data.height && !isNaN(data.height)) {
          size = Math.min(size, +data.height);
        }

        if (data.file) {
          data.url = server.download({
            value: data.file
          }, size ? {
            size: size
          } : null).src;
        } else if (size) {
          if (data.url.indexOf('&size') !== -1) {
            data.url = data.url.replace(/(&size=)\d+/, '$1' + size);
          }
        }

        if (image) {
          image.src = data.url;
        } else {
          image = editor.createElement('IMG', {
            src: data.url
          });
          editor.insertElement(image);
        }

        if (data.file) {
          image.setAttribute('data-src', data.file);
        }

        if (data.width) {
          image.width = data.width;
        }

        if (data.height) {
          image.height = data.height;
        }

        dialog = null;

        return editor.focus();
      };

      var sizes = [80, 120, 160, 240, 320, 480, 640, 960]
      .map(function(size) {
        return '<option value="' + size + '">';
      });

      var fields = [{
        type: 'custom',
        value: '<datalist id="dimension-sizes">' + sizes.join('') + '</datalist>'
      }, {
        group: 'dimension',
        label: '图片尺寸',
        inline: true,
        fields: [{
          name: 'width',
          value: image && image.width || '',
          attrs: {
            placeholder: '宽，像素值',
            'data-rule': 'number digits',
            'data-display': '宽',
            'list': 'dimension-sizes'
          }
        }, {
          type: 'custom',
          cls: 'sep',
          value: '-'
        }, {
          name: 'height',
          value: image && image.height || '',
          attrs: {
            placeholder: '高，像素值',
            'data-rule': 'number digits',
            'data-display': '高',
            'list': 'dimension-sizes'
          }
        }]
      }, {
        label: '图片地址',
        name: 'url',
        attrs: {
          // required: 'required'
        }
      }];

      var pluginCfg = {};

      if (server) {
        fields.push({
          type: 'custom',
          cls: 'sep-v',
          value: 'or'
        }, {
          label: '本地文件',
          name: 'file',
          type: 'file',
          attrs: {
            multiple: false,
            accept: '.gif,.jpg,.jpeg,.bmp,.png',
            title: '图片文件',
            swf: '/lib/uploader.swf'
          }
        });

        pluginCfg.Upload = [function() {
          this.setOptions('config', {
            server: server
          });
        }];
      }

      dialog = new FormDialog({
          title: '插入图片',
          formData: {
            url: url
          },
          fields: fields,
          pluginCfg: pluginCfg
        })
        .on('formCancel', function() {
          this.destroy();
        })
        .on('formSubmit', function() {
          var that = this;

          // 调用队列
          this.submit(function(data) {
            makeImage(data);
            that.destroy();
          });

          // 阻止默认事件发生
          return false;
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
