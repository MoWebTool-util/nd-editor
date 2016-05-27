/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict'

module.exports = function() {
  var plugin = this,
    host = plugin.host

  host.addButton({
    role: 'dir',
    action: 'ltr',
    text: 'Left to Right',
    group: 'direction',
    handlers: function(e, d) {
      d.editor.forEachBlock(function(block) {
        if (block.dir === d.action) {
          block.removeAttribute('dir')
        } else {
          block.dir = d.action
        }
      }, true)

      return d.editor.focus()
    }
  })

  host.addButton({
    role: 'dir',
    action: 'rtl',
    text: 'Right to Left',
    group: 'direction'
  })

  host.on('viewChange', function(state) {
    host.enableButton('dir', state === 'wysiwyg')
  })

  // 通知就绪
  this.ready()
}
