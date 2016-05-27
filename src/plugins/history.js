/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict'

module.exports = function() {
  var plugin = this,
    host = plugin.host

  var canUndo, canRedo

  host.addButton({
    role: 'undo',
    text: 'Undo',
    group: 'tool',
    shortcut: 'ctrl+z',
    disabled: true,
    handlers: function(e, d) {
      return d.editor.getPlugin('undo').exports.undo()
    }
  })

  host.addButton({
    role: 'redo',
    text: 'Redo',
    group: 'tool',
    shortcut: 'ctrl+y ctrl+shift+z',
    disabled: true,
    handlers: function(e, d) {
      return d.editor.getPlugin('undo').exports.redo()
    }
  })

  host.ready(function(editor) {
    editor.on('undoStateChange', function(e) {
      host.enableButton('undo', canUndo = e.canUndo)
      host.enableButton('redo', canRedo = e.canRedo)
    })
  })

  host.on('viewChange', function(state) {
    host.enableButton('undo', canUndo && state === 'wysiwyg')
    host.enableButton('redo', canRedo && state === 'wysiwyg')
  })

  // 通知就绪
  this.ready()
}
