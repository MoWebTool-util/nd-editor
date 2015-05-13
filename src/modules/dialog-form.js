/**
 * @module: Editor
 * @author: crossjs <liwenfu@crossjs.com> - 2015-05-07 13:05:11
 */

'use strict';

var $ = require('jquery');
var Confirm = require('nd-confirm');
var Form = require('nd-form');
var Upload = require('nd-upload');
var Validator = require('nd-validator');

var DialogForm = Confirm.extend({
  attrs: {
    message: '',
    afterRender: function() {
      this.form = new Form($.extend(true, {
        className: 'ui-form-simple',
        plugins: [Upload, Validator],
        parentNode: this.$('[data-role="message"]')
      }, this.get('formAttrs'))).render();

      this.before('destroy', function() {
        this.form.destroy();
      });
    },
    callback: function() {},
    onConfirm: function() {
      var that = this;
      // 调用队列
      this.form.submit(function(data) {
        that.get('callback')(data);

        that.hide();
      });

      // 阻止默认事件发生
      return false;
    }
  }
});

module.exports = DialogForm;
