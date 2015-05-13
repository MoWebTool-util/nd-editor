/**
 * @module: Editor
 * @author: crossjs <liwenfu@crossjs.com> - 2015-05-07 13:05:11
 */

'use strict';

module.exports = function() {
  var plugin = this,
    host = plugin.host;

  host.addButton({
    role: 'align',
    action: 'left',
    text: 'Align Left',
    group: 'alignment',
    handlers: function(e, d) {
      d.editor.forEachBlock(function(block) {
        var style = block.style;
        if (style.getPropertyValue('text-align') === d.action) {
          style.removeProperty('text-align');
        } else {
          style.setProperty('text-align', d.action);
        }
      }, true);

      return d.editor.focus();
    }
  });

  host.addButton({
    role: 'align',
    action: 'center',
    text: 'Align Center',
    group: 'alignment'
  });

  host.addButton({
    role: 'align',
    action: 'right',
    text: 'Align Right',
    group: 'alignment'
  });

  host.addButton({
    role: 'align',
    action: 'justify',
    text: 'Align Justify',
    group: 'alignment'
  });

  host.on('viewChange', function(state) {
    host.enableButton('align', state === 'wysiwyg');
  });

  // 通知就绪
  this.ready();
};
