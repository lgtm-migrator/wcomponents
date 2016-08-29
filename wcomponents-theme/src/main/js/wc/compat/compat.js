/**
 * This loader plugin module determines the the dependencies we need to load the configure JS environment with the necessary
 * features expected by the rest of the codebase, i.e. polyfills.
 *
 * It is intended that this loader plugin will be a loader dependency <http://requirejs.org/docs/api.html#config-deps>
 * it **must** run before other modules because it loads the compatibility modules and fixes required for
 * this browser to handle the rest of the codebase.
 *
 * You **must not** load anything here that needs to wire up events (those are fixes, not compatibility
 * code). This is for basic scripting API support.
 *
 * Many of the tests are written by us for our own specific needs however some are also lifted with little or no
 * change from the has project: <https://github.com/phiggins42/has.js/>
 *
 * Read the source Luke!
 *
 * @module
 * @private
 * @param has @ignore
 */
define(["wc/has"], function(has) {
	"use strict";
	var global = window,
		result = ["lib/dojo/sniff"],
		promisify = function(deps) {
			var i, promises = [];
			for (i = 0; i < deps.length; i++) {  // Don't use array.map here in case the browser doesn't support it
				promises.push(global.SystemJS["import"](deps[i]));
			}
			return promises;
		};

	(function(addtest) {
		// This block taken from tests from hasjs project. Didn't want to load the whole script.
		addtest("bug-getelementsbyname", function(g, d) {
			var buggy,
				script = d.createElement("script"),
				id = "__test_" + Number(new Date()),
				root = d.getElementsByTagName("script")[0].parentNode;

			script.id = id;
			script.type = "text/javascript";
			root.insertBefore(script, root.firstChild);
			buggy = d.getElementsByName(id)[0] === script;
			root.removeChild(script);
			return buggy;
		});

		// true for IE < 9
		// http://msdn.microsoft.com/en-us/library/ms536389(VS.85).aspx vs
		// http://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-2141741547
		addtest("dom-create-attr", function(g, d) {
			var input,
				supported = false;
			try {
				input = d.createElement("<input type='hidden' name='hasjs'>");
				supported = input.type === "hidden" && input.name === "hasjs";
			}
			catch (e) {
				// Do nothing
			}
			return supported;
		});
	})(has.add);

	(function(addtest) {

		addtest("ie-compat-mode", function(g) {
			var isCompatModeRe = /MSIE 7\..+Trident\/\d/;
			return isCompatModeRe.test(g.navigator.userAgent);
		});

		addtest("activex", function(g) {
			return !!("ActiveXObject" in g);
		});

		addtest("flash", function(g) {
			var flashPlayer, hasFlash = false;
			if (has("activex")) {
				try {
					flashPlayer = new ActiveXObject("ShockwaveFlash.ShockwaveFlash");
					if (flashPlayer) {
						hasFlash = true;
					}
				}
				catch (ignore) {
					// ignore
				}
			}
			hasFlash = hasFlash || g.navigator && g.navigator.plugins && g.navigator.plugins["Shockwave Flash"];
			return hasFlash;
		});

		addtest("bug-button-value", function(g, d) {
			var button, value = "hi";
			button = d.createElement("button");
			button.value = value;
			button.innerHTML = "<span>howdy</span>";
			return button.value !== value;
		});

		addtest("formdata", function(g) {
			return "FormData" in g;
		});

		addtest("draganddrop", function(g, d, el) {
			return "draggable" in el;
		});

		addtest("native-console", function(g) {
			return ("console" in g);
		});

		addtest("native-console-debug", function(g) {
			return (has("native-console") && "debug" in g.console);
		});

		addtest("native-console-time", function(g) {
			return (has("native-console") && "time" in g.console);
		});

		addtest("global-node", function(g) {
			return ("Node" in g);
		});

		addtest("global-nodefilter", function(g) {
			return ("NodeFilter" in g);
		});

		addtest("global-keyevent", function(g) {
			return ("KeyEvent" in g);
		});

		addtest("global-performance", function(g) {
			return (("performance" in g) && !!g.performance);  // will be present but null in FF 17 if page generated by XSLT
		});

		addtest("global-performance-marking", function(g) {
			return (has("global-performance") && "mark" in g.performance);
		});


		addtest("dom-createtreewalker", function(g, d) {
			return ("createTreeWalker" in d);
		});

		addtest("dom-canvas", function(g, d) {
			var e = d.createElement("canvas");
			return !!(e.getContext && e.getContext("2d"));
		});

		addtest("dom-comparedocumentposition", function(g, d, el) {
			return ("compareDocumentPosition" in el);
		});

		addtest("function-bind", function(g) {
			return !!g.Function.prototype.bind;
		});

		addtest("promise-es6", function(g) {
			return ("Promise" in g);
		});

		addtest("date-now", function(g) {
			return !!g.Date.now;
		});

		addtest("object-defineproperty", function(g) {
			return !!g.Object.defineProperty;
		});

		addtest("object-defineproperty-dom", function(g, d, el) {
			return hasWorkingObjectDefineProperty(g, el);
		});

		addtest("object-defineproperty-pojo", function(g) {
			return hasWorkingObjectDefineProperty(g, {});
		});

		addtest("object-definegetter", function(g) {
			return (typeof g.Object.__defineGetter__ !== "undefined");
		});

		addtest("object-definesetter", function(g) {
			return (typeof g.Object.__defineSetter__ !== "undefined");
		});


		addtest("object-getownpropertydescriptor", function(g) {
			return !!g.Object.getOwnPropertyDescriptor;
		});

		addtest("object-keys", function(g) {
			return !!g.Object.keys;
		});

		addtest("object-create", function(g) {
			return (typeof g.Object.create === "function");
		});

		addtest("object-assign", function(g) {
			return (typeof g.Object.assign === "function");
		});

		addtest("string-trim", function() {
			/* jshint -W053 */
			/* eslint-disable */
			var s = new String(" "),
				result = ("trim" in s);
			/*eslint-enable */
			// Safari (5, Windows) has String.prototype.trim() but it is incompatible with strict mode
			if (result) {
				try {
					s.trim();
				}
				catch (e) {
					result = false;  // not good enough to count
				}
			}
			return result;
		});

		addtest("element-datalist", function() {
			return "list" in document.createElement("input");
		});

		addtest("element-details", function() {
			return "open" in document.createElement("details");
		});

		addtest("native-dateinput", function() {
			var el, d = "date", result = false;
			try {
				el = document.createElement("input");
				el.type = d;
				result = d === el.type;
			}
			catch (e) {
				result = false;
			}
			finally {
				el = null;
			}
			return result;
		});

		addtest("rtc-gum", function(g) {
			var i, next, props = ["getUserMedia", "webkitGetUserMedia", "mozGetUserMedia", "msGetUserMedia"];
			for (i = 0; i < props.length; i++) {
				next = props[i];
				if ((g.navigator.mediaDevices && g.navigator.mediaDevices[next]) || g.navigator[next]) {
					return true;
				}
			}
			return false;
		});

		function hasWorkingObjectDefineProperty(g, obj) {
			var result = has("object-defineproperty");
			if (result) {  // it has defineProperty but does it work?
				try {
					g.Object.defineProperty(obj, "id", { get: function() {
						return "c";
					}});
				}
				catch (ex) {
					result = false;  // this is not a working defineProperty (i.e. perhaps Safari 5 which does not support defineProperty on DOM objects)
				}
			}
			return result;
		}
	})(has.add);

	/*
	 * Q. Why do we patch the Array prototype instead of providing a set of array library functions?
	 * A. Many reasons, one of the main ones is that once you have provided library functions they are
	 * very hard to take away. So even when ES5 array methods are completely taken for granted and available
	 * in even the lowest of the low you will still be stuck with the overhead of your library functions.
	 *
	 * This has already happened, we used to ship with many more array fixes but they are no longer necessary
	 * so we deleted the code. That simple, we did not need to change any application code because everything
	 * simply kept working using native methods that are now ubiquitous.
	 *
	 * Q. Extending the DOM is bad isn't it?
	 * A. Yes. But we never extend it, we "standardize" it. At no time do we ever add any feature to the DOM that is
	 * not 100% standard.
	 *
	 */
	(function(Array, addtest) {

		addtest("array-every", function() {
			return !!Array.prototype.every;
		});

		addtest("array-filter", function() {
			return !!Array.prototype.filter;
		});

		addtest("array-foreach", function() {
			return !!Array.prototype.forEach;
		});

		addtest("array-indexof", function() {
			return !!Array.prototype.indexOf;
		});

		addtest("array-isarray", function() {
			return !!Array.isArray;
		});

		addtest("array-lastindexof", function() {
			return !!Array.prototype.lastIndexOf;
		});

		addtest("array-map", function() {
			return !!Array.prototype.map;
		});

		addtest("array-reduce", function() {
			return !!Array.prototype.reduce;
		});

		addtest("array-reduceright", function() {
			return !!Array.prototype.reduceRight;
		});

		addtest("array-some", function() {
			return !!Array.prototype.some;
		});

		addtest("array-es5", function() {
			return has("array-every") && has("array-filter") && has("array-foreach") &&
				has("array-indexof") && has("array-isarray") && has("array-lastindexof") &&
				has("array-map") && has("array-reduce") && has("array-reduceright") &&
				has("array-some");
		});
	})(global.Array, has.add);

	// ALWAYS FETCH
	// as little as possible

	// CONDITIONALLY FETCH
	if (!has("object-defineproperty-dom") && has("object-definegetter")) {
		result.push("wc/ecma5/Object.defineProperty");
	}

	if (!has("object-getownpropertydescriptor") && has("object-definesetter")) {
		result.push("wc/ecma5/Object.getOwnPropertyDescriptor");
	}

	if (!has("string-trim")) {
		result.push("wc/ecma5/String.prototype.trim");
	}

	if (!has("object-keys")) {
		result.push("wc/ecma5/Object.keys");
	}

	if (!has("object-create")) {
		result.push("wc/ecma5/Object.create");
	}

	if (!has("object-assign")) {
		result.push("wc/ecma6/Object.assign");
	}


	if (!has("date-now")) {
		result.push("wc/ecma5/Date.now");
	}

	if (!has("promise-es6")) {
		result.push("Promise");
	}

	if (!has("function-bind")) {
		/*
		 * NOTE: this is an ugly fix for an IE8 race condition exacerbated by
		 * the memory leak issue fixed by a MS hotfix: see KB2032595.
		 * result.push("wc/ecma5/Function.prototype.bind");
		 */
		global.Function.prototype.bind = function (obj) {
			var slice = [].slice,
				args = slice.call(arguments, 1),
				self = this,
				Nop = function() {
					this.toString = function() {
						return self.toString();
					};
				},
				bound = function() {
					return self.apply((Nop.prototype && this instanceof Nop) ? this : ( obj || (global || {} )),
							args.concat(slice.call(arguments)));
				};
			Nop.prototype = self.prototype;
			bound.prototype = new Nop();
			return bound;
		};
	}

	if (!(has("native-console") && has("native-console-debug") && (has("native-console-time")))) {
		result.push("wc/compat/console");
	}
	if (!has("global-node")) {
		result.push("wc/compat/Node");
	}
	if (!has("global-nodefilter") || !has("dom-createtreewalker")) {
		result.push("wc/compat/TreeWalker");
	}
	if (!has("global-keyevent")) {
		result.push("wc/compat/KeyEvent");
	}
	if (!has("dom-createtreewalker")) {
		result.push("wc/compat/TreeWalker");
	}
	if (!has("dom-comparedocumentposition")) {
		result.push("wc/compat/compareDocumentPosition");
	}
	if (!has("array-every")) {
		result.push("wc/ecma5/Array.prototype.every");
	}
	if (!has("array-filter")) {
		result.push("wc/ecma5/Array.prototype.filter");
	}
	if (!has("array-foreach")) {
		result.push("wc/ecma5/Array.prototype.forEach");
	}
	if (!has("array-indexof")) {
		result.push("wc/ecma5/Array.prototype.indexOf");
	}
	if (!has("array-isarray")) {
		result.push("wc/ecma5/Array.isArray");
	}
	if (!has("array-lastindexof")) {
		result.push("wc/ecma5/Array.prototype.lastIndexOf");
	}
	if (!has("array-map")) {
		result.push("wc/ecma5/Array.prototype.map");
	}
	if (!has("array-reduce")) {
		result.push("wc/ecma5/Array.prototype.reduce");
	}
	if (!has("array-reduceright")) {
		result.push("wc/ecma5/Array.prototype.reduceRight");
	}
	if (!has("array-some")) {
		result.push("wc/ecma5/Array.prototype.some");
	}
	if (has("bug-getelementsbyname")) {
		result.push("wc/fix/getElementsByName_ie9");
	}
	if (has("activex")) {
		// while not strictly a fix classes can't put this in their dependency lists so we need to load it really early for conditional loading.
		result.push("wc/fix/getActiveX_ieAll");
	}

	/*
	 * The polyfill for global performance gets loaded up too late to attach load event listeners.
	 * Putting it into wc/fixes gets loaded up too late to attach load event listeners. They have
	 * to be here whether we like it or not. This fix is ONLY needed for IE versions which do not
	 * have globel performance.
	 */
	if (!(has("global-performance") || has("dom-addeventlistener"))) {
		window.attachEvent("onload", function() {
			if (window.requirejs) {
				window.requirejs.config({config: {"wc/compat/navigationTiming": {
					"loadEventStart": ((new Date()) * 1),/* NOTE: our polyfill of Date.now() has not yet loaded */
					"loadEventEnd": ((new Date()) * 1)}}});
			}
		});
	}

	if (global.SystemJS) {
		result = promisify(result);
	}

	result.load = function (id, parentRequire, callback) {
		parentRequire(result, callback);
	};
	return result;
});
