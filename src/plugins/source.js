/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict'

module.exports = function() {
  var plugin = this,
    host = plugin.host

  var inSource = false
  var textarea
  var valueCached

  host.addButton({
    role: 'code',
    text: 'Source Code',
    group: 'tool',
    handlers: function(e, d) {
      if (!textarea) {
        textarea = host.$('.container > textarea')
      }

      host.trigger('viewChange', inSource ? 'wysiwyg' : 'source')

      if (inSource) {
        inSource = false
        d.button.className = d.button.className.replace(/(\b|\s)active(\b|\s)/, ' ').trim()

        var value = textarea.val()

        if (value !== valueCached) {
          d.editor.setHTML(value)
        }

        textarea.hide().empty()
        return d.editor.focus()
      } else {
        inSource = true
        d.button.className += ' active'

        valueCached = d.editor.getHTML()

        return textarea.val(valueCached).show().focus()
      }
    }
  })

  // 通知就绪
  this.ready()
}
