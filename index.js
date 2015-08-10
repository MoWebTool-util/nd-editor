/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict';

var $ = require('jquery');
var Widget = require('nd-widget');
var Template = require('nd-template');

var Squire = require('./src/squire/squire');

var Editor = Widget.extend({

  Implements: [Template],

  Plugins: require('./src/plugins'),

  attrs: {
    classPrefix: 'ui-editor',
    template: require('./src/templates/editor.handlebars'),

    buttonbar: require('./src/templates/buttonbar.handlebars'),
    container: require('./src/templates/container.handlebars'),
    statusbar: require('./src/templates/statusbar.handlebars'),

    buttons: {
      'misc': []
    },

    parentNode: {
      value: null, // required
      getter: function(val) {
        return val || this.get('trigger');
      }
    },

    insertInto: function(element, parentNode) {
      element.insertAfter(parentNode);
    },

    inFilter: function(data) {
      return data;
    },

    outFilter: function(data) {
      return data;
    }
  },

  events: {},

  setup: function() {
    this._renderButtonbar();
    this._renderContainer();

    this.ready(function(editor) {
      editor.on('pathChange', function(e) {
        this._renderStatusbar(e.path);
      }.bind(this));

      this._renderStatusbar(editor.getPath());
    });

    this._initSquire();
  },

  _initSquire: function() {
    var that = this;

    this.$('iframe').on('load', function() {
      // Make sure we're in standards mode.
      var doc = this.contentDocument;

      if (doc.compatMode !== 'CSS1Compat') {
        doc.open();
        doc.write(require('./src/templates/document.html'));
        doc.close();
      }

      // doc.close() can cause a re-entrant load event in some browsers,
      // such as IE9.
      if (that.editor) {
        return;
      }

      // Create Squire instance
      that.editor = new Squire({
        host: this,
        element: doc,
        defaultBlockTag: 'P'
      }).render();

      that.isReady = true;

      that.editor.setHTML(that.get('inFilter')(that.get('trigger').value));

      that.trigger('ready', that.editor);
    });
  },

  _renderButtonbar: function(buttons) {
    this.$('.buttonbar').html(this.get('buttonbar')({
      buttons: buttons || this.get('buttons')
    }));
  },

  _renderContainer: function() {
    this.$('.container').html(this.get('container')({}));
  },

  _renderStatusbar: function(path) {
    this.$('.statusbar').html(this.get('statusbar')({
      path: path
    }));
  },

  ready: function(callback) {
    if (this.isReady) {
      callback(this.editor);
    } else {
      this.on('ready', callback);
    }
  },

  addShortcut: function(key, handler) {
    handler && this.ready(function(editor) {
      editor.addKeyHandler(key, handler);
    });
  },

  addHandlers: function(role, handlers) {
    Object.keys(handlers).forEach(function(key) {
      var handler = handlers[key];
      this.events[key + ' [data-role="' + role + '"]'] = function(e) {
        var button = e.currentTarget;
        handler(e, {
          editor: this.editor,
          role: role,
          action: button.getAttribute('data-action'),
          // shortcut: button.getAttribute('data-shortcut'),
          button: button
        });
      };
    }.bind(this));
  },

  addButton: function(options, index) {
    if (typeof options.handlers === 'function') {
      options.handlers = {
        'click': options.handlers
      };
    }

    // 快捷键绑定
    if (options.shortcut) {
      // this.addShortcut(options.shortcut, function(e, d) {
      //   d.role = options.role;
      //   options.handlers.click(e, d);
      // });
      this.addShortcut(options.shortcut, options.handlers.click);

      // clear
      // delete options.shortcut;
    }

    // 按钮事件绑定
    if (options.handlers) {
      this.addHandlers(options.role, options.handlers);

      // clear
      delete options.handlers;
    }

    var buttons = this.get('buttons');

    if (!options.group) {
      options.group = 'misc';
    } else {
      if (!buttons[options.group]) {
        buttons[options.group] = [];
      }
    }

    var scope = buttons[options.group];
    // clear
    // delete options.group;

    if (typeof index === 'undefined') {
      scope.push(options);
    } else {
      scope.splice(index, 0, options);
    }
  },

  _findButton: function(role, action) {
    var selector = '[data-role="' + role + '"]';

    if (action) {
      selector += '[data-action="' + action + '"]';
    }

    if (!this._cachedButtons) {
      this._cachedButtons = {};
    }

    if (!(selector in this._cachedButtons)) {
      this._cachedButtons[selector] = this.$(selector);
    }

    return this._cachedButtons[selector];
  },

  activeButton: function(role, action, actived) {
    if (typeof actived === 'undefined') {
      actived = action;
      action = null;
    }

    return this._findButton(role, action).toggleClass('active', actived);
  },

  enableButton: function(role, action, enabled) {
    if (typeof enabled === 'undefined') {
      enabled = action;
      action = null;
    }

    return this._findButton(role, action).attr('disabled', !enabled);
  },

  execute: function(callback) {
    this.get('trigger').value = this.get('outFilter')(this.editor.getHTML().replace(/<p><br><\/p>/g, ''));
    callback();
  }

});

Editor.pluginEntry = {
  name: 'Editor',
  starter: function() {
    var plugin = this,
      host = plugin.host;

    var _widgets = plugin.exports = {};

    function addWidget(name, instance) {
      _widgets[name] = instance;

      plugin.trigger('export', instance, name);
    }

    plugin.execute = function() {
      host.$('[x-type="wysiwyg"]')
      .filter(':not([data-rendered])')
      .each(function(i, field) {
        field.style.display = 'none';
        field.setAttribute('data-rendered', 'true');
        addWidget(field.name, new Editor($.extend(true, {
          trigger: field
        }, plugin.getOptions('config'))).render());
      });
    };

    typeof host.use === 'function' &&
      plugin.on('export', function(instance) {
        host.use(function(next) {
          // destroyed
          if (!instance.element) {
            return next();
          }
          instance.execute(function(err) {
            if (!err) {
              next();
            }
          }, 'Editor');
        });
      });

    host.after('render', plugin.execute);

    typeof host.addField === 'function' &&
      host.after('addField', plugin.execute);

    typeof host.removeField === 'function' &&
      host.before('removeField', function(name) {
        if (name in _widgets) {
          _widgets[name].destroy();
        }
      });

    host.before('destroy', function() {
      Object.keys(_widgets).forEach(function(key) {
        _widgets[key].destroy();
      });
    });

    plugin.getWidget = function(name) {
      return _widgets[name];
    };

    // 通知就绪
    this.ready();
  }
};

module.exports = Editor;
