/**
 * @module Editor
 * @author crossjs <liwenfu@crossjs.com>
 */

'use strict';

module.exports = function() {
  var plugin = this,
    // host === editor
    host = plugin.host,
    env = host.env;

  var _ignoreChange = false;

  var ignoreChange = function() {
    _ignoreChange = true;
  };

  var mutationCallback = function() {
    if (env.canObserveMutations && _ignoreChange) {
      _ignoreChange = false;
      return;
    }

    host.trigger('mutate');
  };

  if (env.canObserveMutations) {
    var mutation = new MutationObserver(mutationCallback);

    mutation.observe(host.getBody(), {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true
    });

    host.before('destroy', function() {
      mutation.disconnect();
    });
  } else {
    host.delegateEvents({
      'keyup': function(e) {
        // Presume document was changed if:
        // 1. A modifier key (other than shift) wasn't held down
        // 2. The key pressed is not in range 16<=x<=20 (control keys)
        // 3. The key pressed is not in range 33<=x<=45 (navigation keys)
        if (!e.ctrlKey && !e.metaKey && !e.altKey &&
          (e.keyCode < 16 || e.keyCode > 20) &&
          (e.keyCode < 33 || e.keyCode > 45)) {
          mutationCallback();
        }
      }
    });
  }

  host.after('_setHTML', ignoreChange);
  host.before('setHTML', ignoreChange);

  // 通知就绪
  this.ready();
};
