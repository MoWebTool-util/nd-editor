/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict';

var __ = require('nd-i18n');
var Alert = require('nd-alert');
var Form = require('nd-form');
var Select = require('nd-select');
var Upload = require('nd-upload');
var Validator = require('nd-validator');

module.exports = Form.extend({
  Plugins: [Select, Upload, Validator],
  attrs: {
    buttons: [{
      label: __('取消'),
      type: 'button',
      role: 'form-cancel'
    }, {
      label: __('提交'),
      type: 'submit',
      role: 'form-submit'
    }],
    className: 'ui-form-dialog',
    beforeSetup: function() {
      this.before('render', function() {
        var form = this;

        form.dialog = new Alert({
          // width: 360,
          // closeTpl: '',
          confirmTpl: '',
          message: '',
          title: form.get('title'),
          // hideOnKeyEscape: false,
          events: {
            // override
            'click [data-role=close]': function(e) {
              e.preventDefault();
              form.destroy();
            }
          }
        }).render();

        // change parentNode
        form.set('parentNode', form.dialog.$('[data-role="message"]'));
      });

      this.after('render', function() {
        this.dialog.show();
      });

      this.before('destroy', function() {
        this.dialog.hide();
      });
    }
  }
});
