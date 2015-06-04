/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict';

var UndoManager = function(editor) {
  this.editor = editor;
  this.reset();
};

UndoManager.prototype = {

  constructor: UndoManager,

  reset: function() {
    this.index = -1;
    this.stack = [];
    this.length = 0;
    this._isInUndo = false;
  },

  inUndo: function(isInUndo) {
    if (typeof isInUndo === 'boolean') {
      this._isInUndo = isInUndo;
    }

    return this._isInUndo;
  },

  // Leaves bookmark
  record: function(range) {
    range || (range = this.editor.range.getSelection());

    // Don't record if we're already in an undo state
    if (!this.inUndo()) {
      // Advance pointer to new position
      var undoIndex = ++this.index,
        undoStack = this.stack;

      // Truncate stack if longer (i.e. if has been previously undone)
      if (undoIndex < this.length) {
        undoStack.length = this.length = undoIndex;
      }

      // Write out data
      if (range) {
        this.editor._saveRangeToBookmark(range);
      }

      undoStack[undoIndex] = this.editor._getHTML();

      this.length++;
      this.inUndo(true);
    }
  },

  change: function(data) {
    this.editor._setHTML(data);

    var range = this.editor._getRangeAndRemoveBookmark();

    if (range) {
      this.editor.range.setSelection(range);
    }
  },

  trigger: function(type, data) {
    this.editor.trigger(type, data);
  },

  hasUndo: function() {
    return this.index !== 0;
  },

  hasRedo: function() {
    return this.index + 1 < this.length;
  },

  undo: function() {
    // Sanity check: must not be at beginning of the history stack
    if (this.index !== 0 || !this.inUndo()) {
      // Make sure any changes since last checkpoint are saved.
      this.record();

      this.change(this.stack[--this.index]);

      this.inUndo(true);

      this.trigger('undoStateChange', {
        canUndo: this.hasUndo(),
        canRedo: true
      });

      this.trigger('input');
    }

    return this;
  },

  redo: function() {
    // Sanity check: must not be at end of stack and must be in an undo
    // state.
    if (this.index + 1 < this.length && this.inUndo()) {
      this.change(this.stack[++this.index]);

      this.trigger('undoStateChange', {
        canUndo: true,
        canRedo: this.hasRedo()
      });

      this.trigger('input');
    }

    return this;
  }

};

module.exports = function() {
  var plugin = this,
    // host === editor
    host = plugin.host,
    env = host.env;

  var undo = plugin.exports = new UndoManager(host);

  host.before('saveRange', function() {
    undo.inUndo(false);
  });

  host.before('modifyBlocks', function() {
    var range = host.range.getSelection();
    // 1. Save undo checkpoint and bookmark selection
    if (undo.inUndo()) {
      host._saveRangeToBookmark(range);
    } else {
      undo.record(range);
    }
  });

  host.before('_getRangeAndRemoveBookmark', function(range, record) {
    record && undo.record(range);
  });

  host.on('mutate', function() {
    if (undo.inUndo()) {
      undo.inUndo(false);
      host.trigger('undoStateChange', {
        canUndo: true,
        canRedo: false
      });
    }
  });

  // 通知就绪
  this.ready();
};
