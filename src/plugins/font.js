/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict';

module.exports = function() {
  var plugin = this,
    host = plugin.host;

  var format = function(tag, remove) {
    remove = remove ? {
      tag: remove
    } : null;

    return function(e, d) {
      e.preventDefault();

      if (d.editor.hasFormat(tag)) {
        d.editor.changeFormat(null, {
          tag: tag
        });
        // host.activeButton(d.role, false);
      } else {
        d.editor.changeFormat({
          tag: tag
        }, remove);
        // host.activeButton(d.role, true);
      }

      return d.editor.focus();
    };
  };

  host.addButton({
    role: 'bold',
    text: 'Bold',
    group: 'font',
    shortcut: 'ctrl+b',
    handlers: format('STRONG')
  });

  host.addButton({
    role: 'italic',
    text: 'Italic',
    group: 'font',
    shortcut: 'ctrl+i',
    handlers: format('EM')
  });

  host.addButton({
    role: 'underline',
    text: 'Underline',
    group: 'font',
    shortcut: 'ctrl+u',
    handlers: format('U')
  });

  host.addButton({
    role: 'strikethrough',
    text: 'Strikethrough',
    group: 'font',
    shortcut: 'ctrl+shift+7',
    handlers: format('S')
  });

  host.addButton({
    role: 'mark',
    text: 'Highlight',
    group: 'font',
    shortcut: 'ctrl+shift+8',
    handlers: format('MARK')
  });

  host.addButton({
    role: 'subscript',
    text: 'Subscript',
    group: 'font',
    shortcut: 'ctrl+shift+5',
    handlers: format('SUB', 'SUP')
  });

  host.addButton({
    role: 'supscript',
    text: 'Superscript',
    group: 'font',
    shortcut: 'ctrl+shift+6',
    handlers: format('SUP', 'SUB')
  });

  // 通知就绪
  this.ready();
};



  setFontFace: function(name) {
    this.changeFormat({
      tag: 'SPAN',
      attributes: {
        'class': 'font',
        style: 'font-family: ' + name + ', sans-serif;'
      }
    }, {
      tag: 'SPAN',
      attributes: {
        'class': 'font'
      }
    });
    return this.focus();
  },

  setFontSize: function(size) {
    this.changeFormat({
      tag: 'SPAN',
      attributes: {
        'class': 'size',
        style: 'font-size: ' +
          (typeof size === 'number' ? size + 'px' : size)
      }
    }, {
      tag: 'SPAN',
      attributes: {
        'class': 'size'
      }
    });

    return this.focus();
  },

  setTextColour: function(colour) {
    this.changeFormat({
      tag: 'SPAN',
      attributes: {
        'class': 'colour',
        style: 'color: ' + colour
      }
    }, {
      tag: 'SPAN',
      attributes: {
        'class': 'colour'
      }
    });

    return this.focus();
  },
,

  clearFormat: function() {
    this.changeFormat(null, {
      tag: '*',
      attributes: {
        'class': '*',
        'style': '*'
      }
    });

    return this.focus();
  }
