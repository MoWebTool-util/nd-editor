/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict'

module.exports = function() {
  var plugin = this,
    host = plugin.host

  var onCut = function() {
    // Save undo checkpoint
    var range = this.range.getSelection()
    // this.undo.record(range);
    this._getRangeAndRemoveBookmark(range, true)
    this.range.setSelection(range)

    setTimeout(function(editor) {
      try {
        // If all content removed, ensure div at start of body.
        editor._ensureBottomLine()
      } catch (error) {
        editor.didError(error)
      }
    }, 0, this)
  }

  // IE sometimes fires the beforepaste event twice; make sure it is not run
  // again before our after paste function is called.
  var awaitingPaste = false

  var onPaste = function(e) {
    if (awaitingPaste) {
      return
    }

    // Treat image paste as a drop of an image file.
    var clipboardData = e.originalEvent.clipboardData,
      items = clipboardData && clipboardData.items,
      fireDrop = false,
      hasImage = false,
      l, type

    if (items) {
      l = items.length
      while (l--) {
        type = items[l].type
        if (type === 'text/html') {
          hasImage = false
          break
        }
        if (/^image\/.*/.test(type)) {
          hasImage = true
        }
      }
      if (hasImage) {
        e.preventDefault()
        this.trigger('dragover', {
          dataTransfer: clipboardData,
          /* jshint loopfunc: true */
          preventDefault: function() {
            fireDrop = true
          }
          /* jshint loopfunc: false */
        })

        if (fireDrop) {
          this.trigger('drop', {
            dataTransfer: clipboardData
          })
        }
        return
      }
    }

    awaitingPaste = true

    var body = this.getBody(),
      range = this.range.getSelection(),
      startContainer, startOffset, endContainer, endOffset, startBlock

    // Record undo checkpoint
    // this.undo.record(range);
    this._getRangeAndRemoveBookmark(range, true)

    // Note current selection. We must do this AFTER recording the undo
    // checkpoint, as this modifies the DOM.
    startContainer = range.startContainer
    startOffset = range.startOffset
    endContainer = range.endContainer
    endOffset = range.endOffset
    startBlock = this.range.getStartBlockOfRange(range)

    // We need to position the pasteArea in the visible portion of the screen
    // to stop the browser auto-scrolling.
    var pasteArea = this.createElement('DIV', {
      style: 'position: absolute; overflow: hidden; top:'
        + (body.scrollTop
        + (startBlock ? startBlock.getBoundingClientRect().top : 0))
        + 'px; left: 0; width: 1px; height: 1px;'
    })

    body.appendChild(pasteArea)
    range.selectNodeContents(pasteArea)
    this.range.setSelection(range)

    // A setTimeout of 0 means this is added to the back of the
    // single javascript thread, so it will be executed after the
    // paste event.
    setTimeout(function(editor) {
      try {
        // Get the pasted content and clean
        var frag = editor.dom.empty(editor.dom.detach(pasteArea)),
          first = frag.firstChild,
          range = editor.range.create(
            startContainer, startOffset, endContainer, endOffset)

        // Was anything actually pasted?
        if (first) {
          // Safari and IE like putting extra divs around things.
          if (first === frag.lastChild && first.nodeName === 'DIV') {
            frag.replaceChild(editor.dom.empty(first), first)
          }

          frag.normalize()
          editor.addLinks(frag)
          editor.cleanTree(frag, false)
          editor.cleanupBRs(frag)
          editor.removeEmptyInlines(frag)

          var node = frag,
            doPaste = true,
            event = {
              fragment: frag,
              preventDefault: function() {
                doPaste = false
              },
              isDefaultPrevented: function() {
                return !doPaste
              }
            }

          while ((node = editor.dom.getNextBlock(node))) {
            editor.dom.fixCursor(node)
          }

          editor.trigger('willPaste', event)

          // Insert pasted data
          if (doPaste) {
            editor.range.insertTreeFragmentIntoRange(range, event.fragment)

            if (!editor.env.canObserveMutations) {
              editor._docWasChanged()
            }

            range.collapse(false)
            editor._ensureBottomLine()
          }
        }

        editor.range.setSelection(range)
        // editor.path.update(range, true);

        awaitingPaste = false
      } catch (error) {
        editor.didError(error)
      }
    }, 0, this)
  }

  host.ready(function(editor) {
    editor.delegateEvents(
      editor.env.isIElt11
      ? {
        beforecut: onCut,
        beforepaste: onPaste
      } : {
        cut: onCut,
        paste: onPaste
      }
    )
  })

  // 通知就绪
  this.ready()
}
