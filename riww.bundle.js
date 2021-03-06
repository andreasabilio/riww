(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (root) {

  // Store setTimeout reference so promise-polyfill will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var setTimeoutFunc = setTimeout;

  function noop() {
  }

  // Use polyfill for setImmediate for performance gains
  var asap = (typeof setImmediate === 'function' && setImmediate) ||
    function (fn) {
      setTimeoutFunc(fn, 1);
    };

  var onUnhandledRejection = function onUnhandledRejection(err) {
    if (typeof console !== 'undefined' && console) {
      console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
    }
  };

  // Polyfill for Function.prototype.bind
  function bind(fn, thisArg) {
    return function () {
      fn.apply(thisArg, arguments);
    };
  }

  function Promise(fn) {
    if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new');
    if (typeof fn !== 'function') throw new TypeError('not a function');
    this._state = 0;
    this._handled = false;
    this._value = undefined;
    this._deferreds = [];

    doResolve(fn, this);
  }

  function handle(self, deferred) {
    while (self._state === 3) {
      self = self._value;
    }
    if (self._state === 0) {
      self._deferreds.push(deferred);
      return;
    }
    self._handled = true;
    asap(function () {
      var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
      if (cb === null) {
        (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
        return;
      }
      var ret;
      try {
        ret = cb(self._value);
      } catch (e) {
        reject(deferred.promise, e);
        return;
      }
      resolve(deferred.promise, ret);
    });
  }

  function resolve(self, newValue) {
    try {
      // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.');
      if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
        var then = newValue.then;
        if (newValue instanceof Promise) {
          self._state = 3;
          self._value = newValue;
          finale(self);
          return;
        } else if (typeof then === 'function') {
          doResolve(bind(then, newValue), self);
          return;
        }
      }
      self._state = 1;
      self._value = newValue;
      finale(self);
    } catch (e) {
      reject(self, e);
    }
  }

  function reject(self, newValue) {
    self._state = 2;
    self._value = newValue;
    finale(self);
  }

  function finale(self) {
    if (self._state === 2 && self._deferreds.length === 0) {
      asap(function() {
        if (!self._handled) {
          onUnhandledRejection(self._value);
        }
      }, 1);
    }
    
    for (var i = 0, len = self._deferreds.length; i < len; i++) {
      handle(self, self._deferreds[i]);
    }
    self._deferreds = null;
  }

  function Handler(onFulfilled, onRejected, promise) {
    this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.promise = promise;
  }

  /**
   * Take a potentially misbehaving resolver function and make sure
   * onFulfilled and onRejected are only called once.
   *
   * Makes no guarantees about asynchrony.
   */
  function doResolve(fn, self) {
    var done = false;
    try {
      fn(function (value) {
        if (done) return;
        done = true;
        resolve(self, value);
      }, function (reason) {
        if (done) return;
        done = true;
        reject(self, reason);
      });
    } catch (ex) {
      if (done) return;
      done = true;
      reject(self, ex);
    }
  }

  Promise.prototype['catch'] = function (onRejected) {
    return this.then(null, onRejected);
  };

  Promise.prototype.then = function (onFulfilled, onRejected) {
    var prom = new Promise(noop);
    handle(this, new Handler(onFulfilled, onRejected, prom));
    return prom;
  };

  Promise.all = function (arr) {
    var args = Array.prototype.slice.call(arr);

    return new Promise(function (resolve, reject) {
      if (args.length === 0) return resolve([]);
      var remaining = args.length;

      function res(i, val) {
        try {
          if (val && (typeof val === 'object' || typeof val === 'function')) {
            var then = val.then;
            if (typeof then === 'function') {
              then.call(val, function (val) {
                res(i, val);
              }, reject);
              return;
            }
          }
          args[i] = val;
          if (--remaining === 0) {
            resolve(args);
          }
        } catch (ex) {
          reject(ex);
        }
      }

      for (var i = 0; i < args.length; i++) {
        res(i, args[i]);
      }
    });
  };

  Promise.resolve = function (value) {
    if (value && typeof value === 'object' && value.constructor === Promise) {
      return value;
    }

    return new Promise(function (resolve) {
      resolve(value);
    });
  };

  Promise.reject = function (value) {
    return new Promise(function (resolve, reject) {
      reject(value);
    });
  };

  Promise.race = function (values) {
    return new Promise(function (resolve, reject) {
      for (var i = 0, len = values.length; i < len; i++) {
        values[i].then(resolve, reject);
      }
    });
  };

  /**
   * Set the immediate function to execute callbacks
   * @param fn {function} Function to execute
   * @private
   */
  Promise._setImmediateFn = function _setImmediateFn(fn) {
    asap = fn;
  };
  
  Promise._setUnhandledRejectionFn = function _setUnhandledRejectionFn(fn) {
    onUnhandledRejection = fn;
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Promise;
  } else if (!root.Promise) {
    root.Promise = Promise;
  }

})(this);

},{}],2:[function(require,module,exports){
(function (process,global){
(function (thisVar, undefined) {
	'use strict';
	var main = (typeof window === 'object' && window) || (typeof global === 'object' && global) ||
		typeof self === 'object' && self || thisVar;

	var hasSetImmediate = typeof setImmediate === 'function';
	var hasNextTick = typeof process === 'object' && !!process && typeof process.nextTick === 'function';
	var index = 0;

	function getNewIndex() {
		if (index === 9007199254740991) {
			return 0;
		}
		return ++index;
	}

	var setAsap = (function () {
		var hiddenDiv, scriptEl, timeoutFn, callbacks;

		// Modern browsers, fastest async
		if (main.MutationObserver) {
			return function setAsap(callback) {
				hiddenDiv = document.createElement("div");
				(new MutationObserver(function() {
					callback();
					hiddenDiv = null;
				})).observe(hiddenDiv, { attributes: true });
				hiddenDiv.setAttribute('i', '1');
			};

		// Browsers that support postMessage
		} else if (!hasSetImmediate && main.postMessage && !main.importScripts && main.addEventListener) {

			var MESSAGE_PREFIX = "com.setImmediate" + Math.random();
			callbacks = {};

			var onGlobalMessage = function (event) {
				if (event.source === main && event.data.indexOf(MESSAGE_PREFIX) === 0) {
					var i = event.data.split(':')[1];
					callbacks[i]();
					delete callbacks[i];
				}
			};

			main.addEventListener("message", onGlobalMessage, false);

			return function setAsap(callback) {
				var i = getNewIndex();
				callbacks[i] = callback;
				main.postMessage(MESSAGE_PREFIX + ':' + i, "*");
			};

			// IE browsers without postMessage
		} else if (!hasSetImmediate && main.document && 'onreadystatechange' in document.createElement('script')) {

			return function setAsap(callback) {
				scriptEl = document.createElement("script");
				scriptEl.onreadystatechange = function onreadystatechange() {
					scriptEl.onreadystatechange = null;
					scriptEl.parentNode.removeChild(scriptEl);
					scriptEl = null;
					callback();
				};
				document.body.appendChild(scriptEl);
			};

		// All other browsers and node
		} else {

			timeoutFn = (hasSetImmediate && setImmediate) || (hasNextTick && process.nextTick) || setTimeout;
			return function setAsap(callback) {
				timeoutFn(callback);
			};
		}

	})();

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = setAsap;
	} else if (typeof require !== 'undefined' && require.amd) {
		define(function () {
			return setAsap;
		});
	} else {
		main.setAsap = setAsap;
	}
})(this);

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":4}],3:[function(require,module,exports){
/**
 * CREDIT
 * http://stackoverflow.com/questions/10343913/how-to-create-a-web-worker-from-a-string
 */

// URL.createObjectURL
window.URL = window.URL || window.webkitURL;

// Dependencies
var Promise = require('promise-polyfill');
var setAsap = require('setasap');
    Promise._setImmediateFn(setAsap);


var wrapper = function wrapper(){

    var fn /* @@@ */;

    // Register message handler
    onmessage = function(msg){

        // Return module source
        postMessage(fn.apply({}, msg.data));

        // Terminate the worker
        close();
    };
};

var buildBlob = function(blob){
    "use strict";

    try {
        return new window.Blob([blob], {type: 'application/javascript'});
    } catch (e) {

        // Backwards-compatibility
        window.BlobBuilder = window.BlobBuilder
            || window.WebKitBlobBuilder
            || window.MozBlobBuilder;

        // Blob setup
        blob = new window.BlobBuilder();
        blob.append(response);
        blob = blob.getBlob();

        return blob;
    }
};


var buildWorkerSrc = function(fnSrc){
    "use strict";

    // Setup
    var workerSrc = [];
    var wrapSrc = wrapper.toString()
        .replace("fn /* @@@ */", "fn = " + fnSrc);

    workerSrc.push("// Estupendo Web Worker\n");
    workerSrc.push("(");
    workerSrc.push(wrapSrc);
    workerSrc.push(")();");

    return workerSrc.join('');
};


module.exports = function(fnSrc, args, ctx){
    "use strict";

    // Setup
    var timeout = 7000;

    // Launch worker
    var workerSrc  = buildWorkerSrc(fnSrc);
    var workerBlob = buildBlob(workerSrc);
    var worker     = new Worker(window.URL.createObjectURL(workerBlob));

    // Args must be an array
    args = (Array.isArray(args))? args : [args];

    // Return a promise
    return new Promise(function(resolve, reject){

        // Register message handler
        worker.onmessage = resolve;

        // SEnd params to worker
        worker.postMessage(args);

        // Setup timeout
        setTimeout(function(){
            var error = new Error('riww ERROR: Worker response timed out', arguments);
            worker.terminate();
            reject(error);
        }, timeout);
    });
};
},{"promise-polyfill":1,"setasap":2}],4:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[3]);
