var __BUNDLE_START_TIME__=globalThis.nativePerformanceNow?nativePerformanceNow():Date.now(),__DEV__=false,process=globalThis.process||{},__METRO_GLOBAL_PREFIX__='';process.env=process.env||{};process.env.NODE_ENV=process.env.NODE_ENV||"production";
(function (global) {
  'use strict';

  if (!global[`${__METRO_GLOBAL_PREFIX__}__d`]) {
    global.__r = metroRequire;
    global[`${__METRO_GLOBAL_PREFIX__}__d`] = define;
    global.__c = clear;
    global.__registerSegment = registerSegment;
  }
  var modules = clear();
  var EMPTY = {};
  var CYCLE_DETECTED = {};
  var {
    hasOwnProperty
  } = {};
  function clear() {
    modules = new Map();
    return modules;
  }
  function define(factory, moduleId, dependencyMap) {
    if (modules.has(moduleId)) {
      return;
    }
    var mod = {
      dependencyMap,
      factory,
      hasError: false,
      importedAll: EMPTY,
      importedDefault: EMPTY,
      isInitialized: false,
      publicModule: {
        exports: {}
      }
    };
    modules.set(moduleId, mod);
  }
  function metroRequire(moduleId, moduleIdHint) {
    if (moduleId === null) {
      throw new Error('Cannot find module');
    }
    var module = modules.get(moduleId);
    return module && module.isInitialized ? module.publicModule.exports : guardedLoadModule(moduleId, module, moduleIdHint);
  }
  function metroImportDefault(moduleId, moduleIdHint) {
    var _modules_get;
    if (modules.has(moduleId) && ((_modules_get = modules.get(moduleId)) == null ? undefined : _modules_get.importedDefault) !== EMPTY) {
      return modules.get(moduleId).importedDefault;
    }
    var exports = metroRequire(moduleId, moduleIdHint);
    var importedDefault = exports && exports.__esModule ? exports.default : exports;
    return modules.get(moduleId).importedDefault = importedDefault;
  }
  metroRequire.importDefault = metroImportDefault;
  function metroImportAll(moduleId, moduleIdHint) {
    var _modules_get;
    if (modules.has(moduleId) && ((_modules_get = modules.get(moduleId)) == null ? undefined : _modules_get.importedAll) !== EMPTY) {
      return modules.get(moduleId).importedAll;
    }
    var exports = metroRequire(moduleId, moduleIdHint);
    var importedAll;
    if (exports && exports.__esModule) {
      importedAll = exports;
    } else {
      importedAll = {};
      if (exports) {
        for (var key in exports) {
          if (hasOwnProperty.call(exports, key)) {
            importedAll[key] = exports[key];
          }
        }
      }
      importedAll.default = exports;
    }
    return modules.get(moduleId).importedAll = importedAll;
  }
  metroRequire[Symbol.for('expo.require')] = true;
  metroRequire.importAll = metroImportAll;
  metroRequire.context = function fallbackRequireContext() {
    throw new Error('The experimental Metro feature `require.context` is not enabled in your project.');
  };
  metroRequire.resolveWeak = function fallbackRequireResolveWeak() {
    throw new Error('require.resolveWeak cannot be called dynamically.');
  };
  metroRequire.unguarded = function requireUnguarded(moduleId, moduleIdHint) {
    var module = modules.get(moduleId);
    return module && module.isInitialized ? module.publicModule.exports : loadModuleImplementation(moduleId, module, moduleIdHint);
  };
  var inGuard = false;
  function guardedLoadModule(moduleId, module, moduleIdHint) {
    if (!inGuard && global.ErrorUtils) {
      inGuard = true;
      var returnValue;
      try {
        returnValue = loadModuleImplementation(moduleId, module, moduleIdHint);
      } catch (e) {
        global.ErrorUtils.reportFatalError(e);
      }
      inGuard = false;
      return returnValue;
    } else {
      return loadModuleImplementation(moduleId, module, moduleIdHint);
    }
  }
  var ID_MASK_SHIFT = 16;
  var LOCAL_ID_MASK = 65535;
  function unpackModuleId(moduleId) {
    if (typeof moduleId !== 'number') {
      throw new Error('Module ID must be a number in unpackModuleId.');
    }
    var segmentId = moduleId >>> ID_MASK_SHIFT;
    var localId = moduleId & LOCAL_ID_MASK;
    return {
      segmentId,
      localId
    };
  }
  metroRequire.unpackModuleId = unpackModuleId;
  function packModuleId(value) {
    return (value.segmentId << ID_MASK_SHIFT) + value.localId;
  }
  metroRequire.packModuleId = packModuleId;
  var moduleDefinersBySegmentID = [];
  var definingSegmentByModuleID = new Map();
  function registerSegment(segmentId, moduleDefiner, moduleIds) {
    moduleDefinersBySegmentID[segmentId] = moduleDefiner;
    if (moduleIds) {
      moduleIds.forEach(moduleId => {
        if (!modules.has(moduleId) && !definingSegmentByModuleID.has(moduleId)) {
          definingSegmentByModuleID.set(moduleId, segmentId);
        }
      });
    }
  }
  function loadModuleImplementation(moduleId, module, moduleIdHint) {
    if (!module && moduleDefinersBySegmentID.length > 0) {
      var segmentId = definingSegmentByModuleID.get(moduleId) ?? 0;
      var definer = moduleDefinersBySegmentID[segmentId];
      if (definer != null) {
        definer(moduleId);
        module = modules.get(moduleId);
        definingSegmentByModuleID.delete(moduleId);
      }
    }
    if (!module) {
      throw unknownModuleError(moduleId, moduleIdHint);
    }
    if (module.hasError) {
      throw module.error;
    }
    module.isInitialized = true;
    var {
      factory,
      dependencyMap
    } = module;
    try {
      var moduleObject = module.publicModule;
      moduleObject.id = moduleId;
      factory == null ? undefined : factory(global, metroRequire, metroImportDefault, metroImportAll, moduleObject, moduleObject.exports, dependencyMap);
      {
        module.factory = undefined;
        module.dependencyMap = undefined;
      }
      return moduleObject.exports;
    } catch (e) {
      module.hasError = true;
      module.error = e;
      module.isInitialized = false;
      module.publicModule.exports = undefined;
      throw e;
    } finally {}
  }
  function unknownModuleError(id, moduleIdHint) {
    var message = 'Requiring unknown module "' + (id ?? moduleIdHint ?? `[unknown optional import]`) + '".';
    return Error(message);
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);
(function (global) {
  /**
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   * @format
   * 
   * @nolint
   * @polyfill
   */

  'use client';

  /* eslint-disable no-shadow, eqeqeq, no-unused-vars, no-control-regex  */

  /**
   * This pipes all of our console logging functions to native logging so that
   * JavaScript errors in required modules show up in Xcode via NSLog.
   */
  var inspect = function () {
    // Copyright Joyent, Inc. and other Node contributors.
    //
    // Permission is hereby granted, free of charge, to any person obtaining a
    // copy of this software and associated documentation files (the
    // "Software"), to deal in the Software without restriction, including
    // without limitation the rights to use, copy, modify, merge, publish,
    // distribute, sublicense, and/or sell copies of the Software, and to permit
    // persons to whom the Software is furnished to do so, subject to the
    // following conditions:
    //
    // The above copyright notice and this permission notice shall be included
    // in all copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
    // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
    // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
    // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
    // USE OR OTHER DEALINGS IN THE SOFTWARE.
    //
    // https://github.com/joyent/node/blob/master/lib/util.js

    function inspect(obj, opts) {
      var ctx = {
        seen: [],
        formatValueCalls: 0,
        stylize: stylizeNoColor
      };
      return formatValue(ctx, obj, opts.depth);
    }
    function stylizeNoColor(str, styleType) {
      return str;
    }
    function arrayToHash(array) {
      var hash = {};
      array.forEach(function (val, idx) {
        hash[val] = true;
      });
      return hash;
    }
    function formatValue(ctx, value, recurseTimes) {
      ctx.formatValueCalls++;
      if (ctx.formatValueCalls > 200) {
        return `[TOO BIG formatValueCalls ${ctx.formatValueCalls} exceeded limit of 200]`;
      }

      // Primitive types cannot have properties
      var primitive = formatPrimitive(ctx, value);
      if (primitive) {
        return primitive;
      }

      // Look up the keys of the object.
      var keys = Object.keys(value);
      var visibleKeys = arrayToHash(keys);

      // IE doesn't make error fields non-enumerable
      // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
      if (isError(value) && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
        return formatError(value);
      }

      // Some type of object without properties can be shortcutted.
      if (keys.length === 0) {
        if (isFunction(value)) {
          var name = value.name ? ': ' + value.name : '';
          return ctx.stylize('[Function' + name + ']', 'special');
        }
        if (isRegExp(value)) {
          return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
        }
        if (isDate(value)) {
          return ctx.stylize(Date.prototype.toString.call(value), 'date');
        }
        if (isError(value)) {
          return formatError(value);
        }
      }
      var base = '',
        array = false,
        braces = ['{', '}'];

      // Make Array say that they are Array
      if (isArray(value)) {
        array = true;
        braces = ['[', ']'];
      }

      // Make functions say that they are functions
      if (isFunction(value)) {
        var n = value.name ? ': ' + value.name : '';
        base = ' [Function' + n + ']';
      }

      // Make RegExps say that they are RegExps
      if (isRegExp(value)) {
        base = ' ' + RegExp.prototype.toString.call(value);
      }

      // Make dates with properties first say the date
      if (isDate(value)) {
        base = ' ' + Date.prototype.toUTCString.call(value);
      }

      // Make error with message first say the error
      if (isError(value)) {
        base = ' ' + formatError(value);
      }
      if (keys.length === 0 && (!array || value.length == 0)) {
        return braces[0] + base + braces[1];
      }
      if (recurseTimes < 0) {
        if (isRegExp(value)) {
          return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
        } else {
          return ctx.stylize('[Object]', 'special');
        }
      }
      ctx.seen.push(value);
      var output;
      if (array) {
        output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
      } else {
        output = keys.map(function (key) {
          return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
        });
      }
      ctx.seen.pop();
      return reduceToSingleString(output, base, braces);
    }
    function formatPrimitive(ctx, value) {
      if (isUndefined(value)) return ctx.stylize('undefined', 'undefined');
      if (isString(value)) {
        var simple = "'" + JSON.stringify(value).replace(/^"|"$/g, '').replace(/'/g, "\\'").replace(/\\"/g, '"') + "'";
        return ctx.stylize(simple, 'string');
      }
      if (isNumber(value)) return ctx.stylize('' + value, 'number');
      if (isBoolean(value)) return ctx.stylize('' + value, 'boolean');
      // For some reason typeof null is "object", so special case here.
      if (isNull(value)) return ctx.stylize('null', 'null');
    }
    function formatError(value) {
      return '[' + Error.prototype.toString.call(value) + ']';
    }
    function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
      var output = [];
      for (var i = 0, l = value.length; i < l; ++i) {
        if (hasOwnProperty(value, String(i))) {
          output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, String(i), true));
        } else {
          output.push('');
        }
      }
      keys.forEach(function (key) {
        if (!key.match(/^\d+$/)) {
          output.push(formatProperty(ctx, value, recurseTimes, visibleKeys, key, true));
        }
      });
      return output;
    }
    function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
      var name, str, desc;
      desc = Object.getOwnPropertyDescriptor(value, key) || {
        value: value[key]
      };
      if (desc.get) {
        if (desc.set) {
          str = ctx.stylize('[Getter/Setter]', 'special');
        } else {
          str = ctx.stylize('[Getter]', 'special');
        }
      } else {
        if (desc.set) {
          str = ctx.stylize('[Setter]', 'special');
        }
      }
      if (!hasOwnProperty(visibleKeys, key)) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (ctx.seen.indexOf(desc.value) < 0) {
          if (isNull(recurseTimes)) {
            str = formatValue(ctx, desc.value, null);
          } else {
            str = formatValue(ctx, desc.value, recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (array) {
              str = str.split('\n').map(function (line) {
                return '  ' + line;
              }).join('\n').slice(2);
            } else {
              str = '\n' + str.split('\n').map(function (line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = ctx.stylize('[Circular]', 'special');
        }
      }
      if (isUndefined(name)) {
        if (array && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.slice(1, name.length - 1);
          name = ctx.stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'");
          name = ctx.stylize(name, 'string');
        }
      }
      return name + ': ' + str;
    }
    function reduceToSingleString(output, base, braces) {
      var numLinesEst = 0;
      var length = output.reduce(function (prev, cur) {
        numLinesEst++;
        if (cur.indexOf('\n') >= 0) numLinesEst++;
        return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
      }, 0);
      if (length > 60) {
        return braces[0] + (base === '' ? '' : base + '\n ') + ' ' + output.join(',\n  ') + ' ' + braces[1];
      }
      return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    // NOTE: These type checking functions intentionally don't use `instanceof`
    // because it is fragile and can be easily faked with `Object.create()`.
    function isArray(ar) {
      return Array.isArray(ar);
    }
    function isBoolean(arg) {
      return typeof arg === 'boolean';
    }
    function isNull(arg) {
      return arg === null;
    }
    function isNumber(arg) {
      return typeof arg === 'number';
    }
    function isString(arg) {
      return typeof arg === 'string';
    }
    function isUndefined(arg) {
      return arg === undefined;
    }
    function isRegExp(re) {
      return isObject(re) && objectToString(re) === '[object RegExp]';
    }
    function isObject(arg) {
      return typeof arg === 'object' && arg !== null;
    }
    function isDate(d) {
      return isObject(d) && objectToString(d) === '[object Date]';
    }
    function isError(e) {
      return isObject(e) && (objectToString(e) === '[object Error]' || e instanceof Error);
    }
    function isFunction(arg) {
      return typeof arg === 'function';
    }
    function objectToString(o) {
      return Object.prototype.toString.call(o);
    }
    function hasOwnProperty(obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    }
    return inspect;
  }();
  var INDEX_COLUMN_NAME = '(index)';
  var LOG_LEVELS = {
    trace: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  function getNativeLogFunction(level) {
    return function () {
      var str;
      if (arguments.length === 1 && typeof arguments[0] === 'string') {
        str = arguments[0];
      } else {
        str = Array.prototype.map.call(arguments, function (arg) {
          return inspect(arg, {
            depth: 10
          });
        }).join(', ');
      }

      // TRICKY
      // If more than one argument is provided, the code above collapses them all
      // into a single formatted string. This transform wraps string arguments in
      // single quotes (e.g. "foo" -> "'foo'") which then breaks the "Warning:"
      // check below. So it's important that we look at the first argument, rather
      // than the formatted argument string.
      var firstArg = arguments[0];
      var logLevel = level;
      if (typeof firstArg === 'string' && firstArg.slice(0, 9) === 'Warning: ' && logLevel >= LOG_LEVELS.error) {
        // React warnings use console.error so that a stack trace is shown,
        // but we don't (currently) want these to show a redbox
        // (Note: Logic duplicated in ExceptionsManager.js.)
        logLevel = LOG_LEVELS.warn;
      }
      if (groupStack.length) {
        str = groupFormat('', str);
      }
      global.nativeLoggingHook(str, logLevel);
    };
  }
  function repeat(element, n) {
    return Array.apply(null, Array(n)).map(function () {
      return element;
    });
  }
  function formatCellValue(cell, key) {
    if (key === INDEX_COLUMN_NAME) {
      return cell[key];
    }
    if (cell.hasOwnProperty(key)) {
      var cellValue = cell[key];
      switch (typeof cellValue) {
        case 'function':
          return 'ƒ';
        case 'string':
          return "'" + cellValue + "'";
        case 'object':
          return cellValue == null ? 'null' : '{…}';
      }
      return String(cellValue);
    }
    return '';
  }
  function consoleTablePolyfill(data, columns) {
    var rows;

    // convert object -> array
    if (Array.isArray(data)) {
      rows = data.map((row, index) => {
        var processedRow = {};
        processedRow[INDEX_COLUMN_NAME] = String(index);
        Object.assign(processedRow, row);
        return processedRow;
      });
    } else {
      rows = [];
      for (var key in data) {
        if (data.hasOwnProperty(key)) {
          var processedRow = {};
          processedRow[INDEX_COLUMN_NAME] = key;
          Object.assign(processedRow, data[key]);
          rows.push(processedRow);
        }
      }
    }
    if (rows.length === 0) {
      global.nativeLoggingHook('', LOG_LEVELS.info);
      return;
    }
    if (Array.isArray(columns)) {
      columns = [INDEX_COLUMN_NAME].concat(columns);
    } else {
      columns = Array.from(rows.reduce((columnSet, row) => {
        Object.keys(row).forEach(key => columnSet.add(key));
        return columnSet;
      }, new Set()));
    }
    var stringRows = [];
    var columnWidths = [];

    // Convert each cell to a string. Also
    // figure out max cell width for each column
    columns.forEach(function (k, i) {
      columnWidths[i] = k.length;
      for (var j = 0; j < rows.length; j++) {
        var cellStr = formatCellValue(rows[j], k);
        stringRows[j] = stringRows[j] || [];
        stringRows[j][i] = cellStr;
        columnWidths[i] = Math.max(columnWidths[i], cellStr.length);
      }
    });

    // Join all elements in the row into a single string with | separators
    // (appends extra spaces to each cell to make separators  | aligned)
    function joinRow(row, space) {
      var cells = row.map(function (cell, i) {
        var extraSpaces = repeat(' ', columnWidths[i] - cell.length).join('');
        return cell + extraSpaces;
      });
      space = space || ' ';
      return '| ' + cells.join(space + '|' + space) + ' |';
    }
    var separators = columnWidths.map(function (columnWidth) {
      return repeat('-', columnWidth).join('');
    });
    var separatorRow = joinRow(separators);
    var header = joinRow(columns);
    var table = [header, separatorRow];
    for (var i = 0; i < rows.length; i++) {
      table.push(joinRow(stringRows[i]));
    }

    // Notice extra empty line at the beginning.
    // Native logging hook adds "RCTLog >" at the front of every
    // logged string, which would shift the header and screw up
    // the table
    global.nativeLoggingHook('\n' + table.join('\n'), LOG_LEVELS.info);
  }
  var GROUP_PAD = '\u2502'; // Box light vertical
  var GROUP_OPEN = '\u2510'; // Box light down+left
  var GROUP_CLOSE = '\u2518'; // Box light up+left

  var groupStack = [];
  function groupFormat(prefix, msg) {
    // Insert group formatting before the console message
    return groupStack.join('') + prefix + ' ' + (msg || '');
  }
  function consoleGroupPolyfill(label) {
    global.nativeLoggingHook(groupFormat(GROUP_OPEN, label), LOG_LEVELS.info);
    groupStack.push(GROUP_PAD);
  }
  function consoleGroupCollapsedPolyfill(label) {
    global.nativeLoggingHook(groupFormat(GROUP_CLOSE, label), LOG_LEVELS.info);
    groupStack.push(GROUP_PAD);
  }
  function consoleGroupEndPolyfill() {
    groupStack.pop();
    global.nativeLoggingHook(groupFormat(GROUP_CLOSE), LOG_LEVELS.info);
  }
  function consoleAssertPolyfill(expression, label) {
    if (!expression) {
      global.nativeLoggingHook('Assertion failed: ' + label, LOG_LEVELS.error);
    }
  }
  function stub() {}

  // https://developer.chrome.com/docs/devtools/console/api#createtask
  function consoleCreateTaskStub() {
    return {
      run: cb => cb()
    };
  }
  if (global.nativeLoggingHook) {
    var originalConsole = global.console;
    // Preserve the original `console` as `originalConsole`

    global.console = {
      time: stub,
      timeEnd: stub,
      timeStamp: stub,
      count: stub,
      countReset: stub,
      createTask: consoleCreateTaskStub,
      ...(originalConsole ?? {}),
      error: getNativeLogFunction(LOG_LEVELS.error),
      info: getNativeLogFunction(LOG_LEVELS.info),
      log: getNativeLogFunction(LOG_LEVELS.info),
      warn: getNativeLogFunction(LOG_LEVELS.warn),
      trace: getNativeLogFunction(LOG_LEVELS.trace),
      debug: getNativeLogFunction(LOG_LEVELS.trace),
      table: consoleTablePolyfill,
      group: consoleGroupPolyfill,
      groupEnd: consoleGroupEndPolyfill,
      groupCollapsed: consoleGroupCollapsedPolyfill,
      assert: consoleAssertPolyfill
    };

    // TODO(T206796580): This was copy-pasted from ExceptionsManager.js
    // Delete the copy there after the c++ pipeline is rolled out everywhere.
    if (global.RN$useAlwaysAvailableJSErrorHandling === true) {
      var stringifySafe = function (arg) {
        return inspect(arg, {
          depth: 10
        }).replace(/\n\s*/g, ' ');
      };
      var originalConsoleError = console.error;
      console.error = function (...args) {
        originalConsoleError.apply(this, args);
        if (console.reportErrorsAsExceptions === false) {
          return;
        }
        if (global.RN$inExceptionHandler?.()) {
          return;
        }
        var error;
        var firstArg = args[0];
        if (firstArg?.stack) {
          // RN$handleException will console.error this with high enough fidelity.
          error = firstArg;
        } else {
          if (typeof firstArg === 'string' && firstArg.startsWith('Warning: ')) {
            // React warnings use console.error so that a stack trace is shown, but
            // we don't (currently) want these to show a redbox
            return;
          }
          var message = args.map(arg => typeof arg === 'string' ? arg : stringifySafe(arg)).join(' ');
          error = new Error(message);
          error.name = 'console.error';
        }
        var isFatal = false;
        var reportToConsole = false;
        global.RN$handleException(error, isFatal, reportToConsole);
      };
    }
    Object.defineProperty(console, '_isPolyfilled', {
      value: true,
      enumerable: false
    });

    // If available, also call the original `console` method since that is
    // sometimes useful. Ex: on OS X, this will let you see rich output in
    // the Safari Web Inspector console.
  } else if (!global.console) {
    var log = global.print || stub;
    global.console = {
      debug: log,
      error: log,
      info: log,
      log: log,
      trace: log,
      warn: log,
      assert(expression, label) {
        if (!expression) {
          log('Assertion failed: ' + label);
        }
      },
      clear: stub,
      count: stub,
      countReset: stub,
      dir: stub,
      dirxml: stub,
      group: stub,
      groupCollapsed: stub,
      groupEnd: stub,
      profile: stub,
      profileEnd: stub,
      table: stub,
      time: stub,
      timeEnd: stub,
      timeStamp: stub,
      createTask: consoleCreateTaskStub
    };
    Object.defineProperty(console, '_isPolyfilled', {
      value: true,
      enumerable: false
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);
(function (global) {
  var _inGuard = 0;
  var _globalHandler = global.RN$useAlwaysAvailableJSErrorHandling === true ? global.RN$handleException : (e, isFatal) => {
    throw e;
  };
  var ErrorUtils = {
    setGlobalHandler(fun) {
      _globalHandler = fun;
    },
    getGlobalHandler() {
      return _globalHandler;
    },
    reportError(error) {
      _globalHandler && _globalHandler(error, false);
    },
    reportFatalError(error) {
      _globalHandler && _globalHandler(error, true);
    },
    applyWithGuard(fun, context, args, unused_onError, unused_name) {
      try {
        _inGuard++;
        return fun.apply(context, args);
      } catch (e) {
        ErrorUtils.reportError(e);
      } finally {
        _inGuard--;
      }
      return null;
    },
    applyWithGuardIfNeeded(fun, context, args) {
      if (ErrorUtils.inGuard()) {
        return fun.apply(context, args);
      } else {
        ErrorUtils.applyWithGuard(fun, context, args);
      }
      return null;
    },
    inGuard() {
      return !!_inGuard;
    },
    guard(fun, name, context) {
      if (typeof fun !== 'function') {
        console.warn('A function must be passed to ErrorUtils.guard, got ', fun);
        return null;
      }
      var guardName = name ?? fun.name ?? '<generated guard>';
      function guarded(...args) {
        return ErrorUtils.applyWithGuard(fun, context ?? this, args, null, guardName);
      }
      return guarded;
    }
  };
  global.ErrorUtils = ErrorUtils;
})(typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);
(function (global) {
  try {
    global.$$require_external = typeof expo === "undefined" ? require : moduleId => {
      throw new Error(`Node.js standard library module ${moduleId} is not available in this JavaScript environment`);
    };
  } catch {
    global.$$require_external = moduleId => {
      throw new Error(`Node.js standard library module ${moduleId} is not available in this JavaScript environment`);
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);
(function (global) {})(typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);
(function (global) {
  /**
   * @license
   * web-streams-polyfill v4.1.0
   * Copyright 2024 Mattias Buelens, Diwank Singh Tomer and other contributors.
   * This code is released under the MIT license.
   * SPDX-License-Identifier: MIT
   */
  function _classCallCheck(r, z) {
    if (!(r instanceof z)) throw new TypeError("Cannot call a class as a function");
  }
  function _defineProperties(r, z) {
    for (var D = 0; D < z.length; D++) {
      var te = z[D];
      te.enumerable = te.enumerable || false, te.configurable = true, "value" in te && (te.writable = true), Object.defineProperty(r, _toPropertyKey(te.key), te);
    }
  }
  function _createClass(r, z, D) {
    return z && _defineProperties(r.prototype, z), D && _defineProperties(r, D), Object.defineProperty(r, "prototype", {
      writable: false
    }), r;
  }
  function _toPropertyKey(r) {
    var z = _toPrimitive(r, "string");
    return "symbol" == typeof z ? z : z + "";
  }
  function _toPrimitive(r, z) {
    if ("object" != typeof r || !r) return r;
    var D = r[Symbol.toPrimitive];
    if (undefined !== D) {
      var te = D.call(r, z || "default");
      if ("object" != typeof te) return te;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === z ? String : Number)(r);
  }
  !function () {
    "use strict";

    function e() {}
    function t(r) {
      return "object" == typeof r && null !== r || "function" == typeof r;
    }
    var r = e;
    function o(r, z) {
      try {
        Object.defineProperty(r, "name", {
          value: z,
          configurable: true
        });
      } catch (r) {}
    }
    var z = Promise,
      D = Promise.resolve.bind(z),
      te = Promise.prototype.then,
      re = Promise.reject.bind(z),
      oe = D;
    function u(r) {
      return new z(r);
    }
    function c(r) {
      return u(z => z(r));
    }
    function d(r) {
      return re(r);
    }
    function f(r, z, D) {
      return te.call(r, z, D);
    }
    function b(z, D, te) {
      f(f(z, D, te), undefined, r);
    }
    function h(r, z) {
      b(r, z);
    }
    function m(r, z) {
      b(r, undefined, z);
    }
    function _(r, z, D) {
      return f(r, z, D);
    }
    function p(z) {
      f(z, undefined, r);
    }
    var y = r => {
      if ("function" == typeof queueMicrotask) y = queueMicrotask;else {
        var _r2 = c(undefined);
        y = z => f(_r2, z);
      }
      return y(r);
    };
    function S(r, z, D) {
      if ("function" != typeof r) throw new TypeError("Argument is not a function");
      return Function.prototype.apply.call(r, z, D);
    }
    function g(r, z, D) {
      try {
        return c(S(r, z, D));
      } catch (r) {
        return d(r);
      }
    }
    var de = function () {
      return _createClass(function v() {
        _classCallCheck(this, v), this._cursor = 0, this._size = 0, this._front = {
          _elements: [],
          _next: undefined
        }, this._back = this._front, this._cursor = 0, this._size = 0;
      }, [{
        key: "length",
        get: function () {
          return this._size;
        }
      }, {
        key: "push",
        value: function push(r) {
          var z = this._back;
          var D = z;
          16383 === z._elements.length && (D = {
            _elements: [],
            _next: undefined
          }), z._elements.push(r), D !== z && (this._back = D, z._next = D), ++this._size;
        }
      }, {
        key: "shift",
        value: function shift() {
          var r = this._front;
          var z = r;
          var D = this._cursor;
          var te = D + 1;
          var re = r._elements,
            oe = re[D];
          return 16384 === te && (z = r._next, te = 0), --this._size, this._cursor = te, r !== z && (this._front = z), re[D] = undefined, oe;
        }
      }, {
        key: "forEach",
        value: function forEach(r) {
          var z = this._cursor,
            D = this._front,
            te = D._elements;
          for (; !(z === te.length && undefined === D._next || z === te.length && (D = D._next, te = D._elements, z = 0, 0 === te.length));) r(te[z]), ++z;
        }
      }, {
        key: "peek",
        value: function peek() {
          var r = this._front,
            z = this._cursor;
          return r._elements[z];
        }
      }]);
    }();
    var me = Symbol("[[AbortSteps]]"),
      ye = Symbol("[[ErrorSteps]]"),
      Dt = Symbol("[[CancelSteps]]"),
      nr = Symbol("[[PullSteps]]"),
      ar = Symbol("[[ReleaseSteps]]");
    function q(r, z) {
      r._ownerReadableStream = z, z._reader = r, "readable" === z._state ? O(r) : "closed" === z._state ? function (r) {
        O(r), A(r);
      }(r) : j(r, z._storedError);
    }
    function E(r, z) {
      return Br(r._ownerReadableStream, z);
    }
    function W(r) {
      var z = r._ownerReadableStream;
      "readable" === z._state ? k(r, new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")) : function (r, z) {
        j(r, new TypeError("Reader was released and can no longer be used to monitor the stream's closedness"));
      }(r), z._readableStreamController[ar](), z._reader = undefined, r._ownerReadableStream = undefined;
    }
    function B(r) {
      return new TypeError("Cannot " + r + " a stream using a released reader");
    }
    function O(r) {
      r._closedPromise = u((z, D) => {
        r._closedPromise_resolve = z, r._closedPromise_reject = D;
      });
    }
    function j(r, z) {
      O(r), k(r, z);
    }
    function k(r, z) {
      undefined !== r._closedPromise_reject && (p(r._closedPromise), r._closedPromise_reject(z), r._closedPromise_resolve = undefined, r._closedPromise_reject = undefined);
    }
    function A(r) {
      undefined !== r._closedPromise_resolve && (r._closedPromise_resolve(undefined), r._closedPromise_resolve = undefined, r._closedPromise_reject = undefined);
    }
    var no = Number.isFinite || function (r) {
        return "number" == typeof r && isFinite(r);
      },
      io = Math.trunc || function (r) {
        return r < 0 ? Math.ceil(r) : Math.floor(r);
      };
    function L(r, z) {
      if (undefined !== r && "object" != typeof (D = r) && "function" != typeof D) throw new TypeError(`${z} is not an object.`);
      var D;
    }
    function F(r, z) {
      if ("function" != typeof r) throw new TypeError(`${z} is not a function.`);
    }
    function I(r, z) {
      if (!function (r) {
        return "object" == typeof r && null !== r || "function" == typeof r;
      }(r)) throw new TypeError(`${z} is not an object.`);
    }
    function $(r, z, D) {
      if (undefined === r) throw new TypeError(`Parameter ${z} is required in '${D}'.`);
    }
    function M(r, z, D) {
      if (undefined === r) throw new TypeError(`${z} is required in '${D}'.`);
    }
    function Y(r) {
      return Number(r);
    }
    function Q(r) {
      return 0 === r ? 0 : r;
    }
    function x(r, z) {
      var D = Number.MAX_SAFE_INTEGER;
      var te = Number(r);
      if (te = Q(te), !no(te)) throw new TypeError(`${z} is not a finite number`);
      if (te = function (r) {
        return Q(io(r));
      }(te), te < 0 || te > D) throw new TypeError(`${z} is outside the accepted range of 0 to ${D}, inclusive`);
      return no(te) && 0 !== te ? te : 0;
    }
    function N(r, z) {
      if (!Er(r)) throw new TypeError(`${z} is not a ReadableStream.`);
    }
    function H(r) {
      return new ao(r);
    }
    function V(r, z) {
      r._reader._readRequests.push(z);
    }
    function U(r, z, D) {
      var te = r._reader._readRequests.shift();
      D ? te._closeSteps() : te._chunkSteps(z);
    }
    function G(r) {
      return r._reader._readRequests.length;
    }
    function X(r) {
      var z = r._reader;
      return undefined !== z && !!J(z);
    }
    var ao = function () {
      return _createClass(function ReadableStreamDefaultReader(r) {
        if (_classCallCheck(this, ReadableStreamDefaultReader), $(r, 1, "ReadableStreamDefaultReader"), N(r, "First parameter"), Wr(r)) throw new TypeError("This stream has already been locked for exclusive reading by another reader");
        q(this, r), this._readRequests = new de();
      }, [{
        key: "closed",
        get: function () {
          return J(this) ? this._closedPromise : d(ee("closed"));
        }
      }, {
        key: "cancel",
        value: function cancel(r = undefined) {
          return J(this) ? undefined === this._ownerReadableStream ? d(B("cancel")) : E(this, r) : d(ee("cancel"));
        }
      }, {
        key: "read",
        value: function read() {
          if (!J(this)) return d(ee("read"));
          if (undefined === this._ownerReadableStream) return d(B("read from"));
          var r, z;
          var D = u((D, te) => {
            r = D, z = te;
          });
          return K(this, {
            _chunkSteps: z => r({
              value: z,
              done: false
            }),
            _closeSteps: () => r({
              value: undefined,
              done: true
            }),
            _errorSteps: r => z(r)
          }), D;
        }
      }, {
        key: "releaseLock",
        value: function releaseLock() {
          if (!J(this)) throw ee("releaseLock");
          undefined !== this._ownerReadableStream && function (r) {
            W(r);
            Z(r, new TypeError("Reader was released"));
          }(this);
        }
      }]);
    }();
    function J(r) {
      return !!t(r) && !!Object.prototype.hasOwnProperty.call(r, "_readRequests") && r instanceof ao;
    }
    function K(r, z) {
      var D = r._ownerReadableStream;
      D._disturbed = true, "closed" === D._state ? z._closeSteps() : "errored" === D._state ? z._errorSteps(D._storedError) : D._readableStreamController[nr](z);
    }
    function Z(r, z) {
      var D = r._readRequests;
      r._readRequests = new de(), D.forEach(r => {
        r._errorSteps(z);
      });
    }
    function ee(r) {
      return new TypeError(`ReadableStreamDefaultReader.prototype.${r} can only be used on a ReadableStreamDefaultReader`);
    }
    var lo, so, uo;
    function ne(r) {
      return r.slice();
    }
    function ae(r, z, D, te, re) {
      new Uint8Array(r).set(new Uint8Array(D, te, re), z);
    }
    Object.defineProperties(ao.prototype, {
      cancel: {
        enumerable: true
      },
      read: {
        enumerable: true
      },
      releaseLock: {
        enumerable: true
      },
      closed: {
        enumerable: true
      }
    }), o(ao.prototype.cancel, "cancel"), o(ao.prototype.read, "read"), o(ao.prototype.releaseLock, "releaseLock"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(ao.prototype, Symbol.toStringTag, {
      value: "ReadableStreamDefaultReader",
      configurable: true
    });
    var ie = r => (ie = "function" == typeof r.transfer ? r => r.transfer() : "function" == typeof structuredClone ? r => structuredClone(r, {
        transfer: [r]
      }) : r => r, ie(r)),
      le = r => (le = "boolean" == typeof r.detached ? r => r.detached : r => 0 === r.byteLength, le(r));
    function se(r, z, D) {
      if (r.slice) return r.slice(z, D);
      var te = D - z,
        re = new ArrayBuffer(te);
      return ae(re, 0, r, z, te), re;
    }
    function ue(r, z) {
      var D = r[z];
      if (null != D) {
        if ("function" != typeof D) throw new TypeError(`${String(z)} is not a function`);
        return D;
      }
    }
    function ce(r) {
      try {
        var _z = r.done,
          _D = r.value;
        return f(oe(_D), r => ({
          done: _z,
          value: r
        }));
      } catch (r) {
        return d(r);
      }
    }
    var co = null !== (uo = null !== (lo = Symbol.asyncIterator) && undefined !== lo ? lo : null === (so = Symbol.for) || undefined === so ? undefined : so.call(Symbol, "Symbol.asyncIterator")) && undefined !== uo ? uo : "@@asyncIterator";
    function fe(r, z = "sync", D) {
      if (undefined === D) if ("async" === z) {
        if (undefined === (D = ue(r, co))) return function (r) {
          var z = {
            next() {
              var z;
              try {
                z = be(r);
              } catch (r) {
                return d(r);
              }
              return ce(z);
            },
            return(z) {
              var D;
              try {
                var _te = ue(r.iterator, "return");
                if (undefined === _te) return c({
                  done: true,
                  value: z
                });
                D = S(_te, r.iterator, [z]);
              } catch (r) {
                return d(r);
              }
              return t(D) ? ce(D) : d(new TypeError("The iterator.return() method must return an object"));
            }
          };
          return {
            iterator: z,
            nextMethod: z.next,
            done: false
          };
        }(fe(r, "sync", ue(r, Symbol.iterator)));
      } else D = ue(r, Symbol.iterator);
      if (undefined === D) throw new TypeError("The object is not iterable");
      var te = S(D, r, []);
      if (!t(te)) throw new TypeError("The iterator method must return an object");
      return {
        iterator: te,
        nextMethod: te.next,
        done: false
      };
    }
    function be(r) {
      var z = S(r.nextMethod, r.iterator, []);
      if (!t(z)) throw new TypeError("The iterator.next() method must return an object");
      return z;
    }
    var fo = function () {
      return _createClass(function he(r, z) {
        _classCallCheck(this, he), this._ongoingPromise = undefined, this._isFinished = false, this._reader = r, this._preventCancel = z;
      }, [{
        key: "next",
        value: function next() {
          var e = () => this._nextSteps();
          return this._ongoingPromise = this._ongoingPromise ? _(this._ongoingPromise, e, e) : e(), this._ongoingPromise;
        }
      }, {
        key: "return",
        value: function _return(r) {
          var t = () => this._returnSteps(r);
          return this._ongoingPromise = this._ongoingPromise ? _(this._ongoingPromise, t, t) : t(), this._ongoingPromise;
        }
      }, {
        key: "_nextSteps",
        value: function _nextSteps() {
          if (this._isFinished) return Promise.resolve({
            value: undefined,
            done: true
          });
          var r = this._reader;
          var z, D;
          var te = u((r, te) => {
            z = r, D = te;
          });
          return K(r, {
            _chunkSteps: r => {
              this._ongoingPromise = undefined, y(() => z({
                value: r,
                done: false
              }));
            },
            _closeSteps: () => {
              this._ongoingPromise = undefined, this._isFinished = true, W(r), z({
                value: undefined,
                done: true
              });
            },
            _errorSteps: z => {
              this._ongoingPromise = undefined, this._isFinished = true, W(r), D(z);
            }
          }), te;
        }
      }, {
        key: "_returnSteps",
        value: function _returnSteps(r) {
          if (this._isFinished) return Promise.resolve({
            value: r,
            done: true
          });
          this._isFinished = true;
          var z = this._reader;
          if (!this._preventCancel) {
            var _D2 = E(z, r);
            return W(z), _(_D2, () => ({
              value: r,
              done: true
            }));
          }
          return W(z), c({
            value: r,
            done: true
          });
        }
      }]);
    }();
    var ho = {
      next() {
        return _e(this) ? this._asyncIteratorImpl.next() : d(pe("next"));
      },
      return(r) {
        return _e(this) ? this._asyncIteratorImpl.return(r) : d(pe("return"));
      },
      [co]() {
        return this;
      }
    };
    function _e(r) {
      if (!t(r)) return false;
      if (!Object.prototype.hasOwnProperty.call(r, "_asyncIteratorImpl")) return false;
      try {
        return r._asyncIteratorImpl instanceof fo;
      } catch (r) {
        return false;
      }
    }
    function pe(r) {
      return new TypeError(`ReadableStreamAsyncIterator.${r} can only be used on a ReadableSteamAsyncIterator`);
    }
    Object.defineProperty(ho, co, {
      enumerable: false
    });
    var bo = Number.isNaN || function (r) {
      return r != r;
    };
    function Se(r) {
      var z = se(r.buffer, r.byteOffset, r.byteOffset + r.byteLength);
      return new Uint8Array(z);
    }
    function ge(r) {
      var z = r._queue.shift();
      return r._queueTotalSize -= z.size, r._queueTotalSize < 0 && (r._queueTotalSize = 0), z.value;
    }
    function ve(r, z, D) {
      if ("number" != typeof (te = D) || bo(te) || te < 0 || D === 1 / 0) throw new RangeError("Size must be a finite, non-NaN, non-negative number.");
      var te;
      r._queue.push({
        value: z,
        size: D
      }), r._queueTotalSize += D;
    }
    function we(r) {
      r._queue = new de(), r._queueTotalSize = 0;
    }
    function Re(r) {
      return r === DataView;
    }
    var _o = function () {
      return _createClass(function ReadableStreamBYOBRequest() {
        throw _classCallCheck(this, ReadableStreamBYOBRequest), new TypeError("Illegal constructor");
      }, [{
        key: "view",
        get: function () {
          if (!Ce(this)) throw Ke("view");
          return this._view;
        }
      }, {
        key: "respond",
        value: function respond(r) {
          if (!Ce(this)) throw Ke("respond");
          if ($(r, 1, "respond"), r = x(r, "First parameter"), undefined === this._associatedReadableByteStreamController) throw new TypeError("This BYOB request has been invalidated");
          if (le(this._view.buffer)) throw new TypeError("The BYOB request's buffer has been detached and so cannot be used as a response");
          Ge(this._associatedReadableByteStreamController, r);
        }
      }, {
        key: "respondWithNewView",
        value: function respondWithNewView(r) {
          if (!Ce(this)) throw Ke("respondWithNewView");
          if ($(r, 1, "respondWithNewView"), !ArrayBuffer.isView(r)) throw new TypeError("You can only respond with array buffer views");
          if (undefined === this._associatedReadableByteStreamController) throw new TypeError("This BYOB request has been invalidated");
          if (le(r.buffer)) throw new TypeError("The given view's buffer has been detached and so cannot be used as a response");
          Xe(this._associatedReadableByteStreamController, r);
        }
      }]);
    }();
    Object.defineProperties(_o.prototype, {
      respond: {
        enumerable: true
      },
      respondWithNewView: {
        enumerable: true
      },
      view: {
        enumerable: true
      }
    }), o(_o.prototype.respond, "respond"), o(_o.prototype.respondWithNewView, "respondWithNewView"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(_o.prototype, Symbol.toStringTag, {
      value: "ReadableStreamBYOBRequest",
      configurable: true
    });
    var mo = function () {
      return _createClass(function ReadableByteStreamController() {
        throw _classCallCheck(this, ReadableByteStreamController), new TypeError("Illegal constructor");
      }, [{
        key: "byobRequest",
        get: function () {
          if (!Te(this)) throw Ze("byobRequest");
          return Ve(this);
        }
      }, {
        key: "desiredSize",
        get: function () {
          if (!Te(this)) throw Ze("desiredSize");
          return Ue(this);
        }
      }, {
        key: "close",
        value: function close() {
          if (!Te(this)) throw Ze("close");
          if (this._closeRequested) throw new TypeError("The stream has already been closed; do not close it again!");
          var r = this._controlledReadableByteStream._state;
          if ("readable" !== r) throw new TypeError(`The stream (in ${r} state) is not in the readable state and cannot be closed`);
          Qe(this);
        }
      }, {
        key: "enqueue",
        value: function enqueue(r) {
          if (!Te(this)) throw Ze("enqueue");
          if ($(r, 1, "enqueue"), !ArrayBuffer.isView(r)) throw new TypeError("chunk must be an array buffer view");
          if (0 === r.byteLength) throw new TypeError("chunk must have non-zero byteLength");
          if (0 === r.buffer.byteLength) throw new TypeError("chunk's buffer must have non-zero byteLength");
          if (this._closeRequested) throw new TypeError("stream is closed or draining");
          var z = this._controlledReadableByteStream._state;
          if ("readable" !== z) throw new TypeError(`The stream (in ${z} state) is not in the readable state and cannot be enqueued to`);
          xe(this, r);
        }
      }, {
        key: "error",
        value: function error(r = undefined) {
          if (!Te(this)) throw Ze("error");
          Ne(this, r);
        }
      }, {
        key: Dt,
        value: function (r) {
          qe(this), we(this);
          var z = this._cancelAlgorithm(r);
          return Ye(this), z;
        }
      }, {
        key: nr,
        value: function (r) {
          var z = this._controlledReadableByteStream;
          if (this._queueTotalSize > 0) return void He(this, r);
          var D = this._autoAllocateChunkSize;
          if (undefined !== D) {
            var _te2;
            try {
              _te2 = new ArrayBuffer(D);
            } catch (z) {
              return void r._errorSteps(z);
            }
            var _re = {
              buffer: _te2,
              bufferByteLength: D,
              byteOffset: 0,
              byteLength: D,
              bytesFilled: 0,
              minimumFill: 1,
              elementSize: 1,
              viewConstructor: Uint8Array,
              readerType: "default"
            };
            this._pendingPullIntos.push(_re);
          }
          V(z, r), Pe(this);
        }
      }, {
        key: ar,
        value: function () {
          if (this._pendingPullIntos.length > 0) {
            var _r3 = this._pendingPullIntos.peek();
            _r3.readerType = "none", this._pendingPullIntos = new de(), this._pendingPullIntos.push(_r3);
          }
        }
      }]);
    }();
    function Te(r) {
      return !!t(r) && !!Object.prototype.hasOwnProperty.call(r, "_controlledReadableByteStream") && r instanceof mo;
    }
    function Ce(r) {
      return !!t(r) && !!Object.prototype.hasOwnProperty.call(r, "_associatedReadableByteStreamController") && r instanceof _o;
    }
    function Pe(r) {
      var z = function (r) {
        var z = r._controlledReadableByteStream;
        if ("readable" !== z._state) return false;
        if (r._closeRequested) return false;
        if (!r._started) return false;
        if (X(z) && G(z) > 0) return true;
        if (nt(z) && ot(z) > 0) return true;
        return Ue(r) > 0;
      }(r);
      z && (r._pulling ? r._pullAgain = true : (r._pulling = true, b(r._pullAlgorithm(), () => (r._pulling = false, r._pullAgain && (r._pullAgain = false, Pe(r)), null), z => (Ne(r, z), null))));
    }
    function qe(r) {
      Le(r), r._pendingPullIntos = new de();
    }
    function Ee(r, z) {
      var D = false;
      "closed" === r._state && (D = true);
      var te = Be(z);
      "default" === z.readerType ? U(r, te, D) : function (r, z, D) {
        var te = r._reader._readIntoRequests.shift();
        D ? te._closeSteps(z) : te._chunkSteps(z);
      }(r, te, D);
    }
    function We(r, z) {
      for (var _D3 = 0; _D3 < z.length; ++_D3) Ee(r, z[_D3]);
    }
    function Be(r) {
      var z = r.bytesFilled,
        D = r.elementSize;
      return new r.viewConstructor(r.buffer, r.byteOffset, z / D);
    }
    function Oe(r, z, D, te) {
      r._queue.push({
        buffer: z,
        byteOffset: D,
        byteLength: te
      }), r._queueTotalSize += te;
    }
    function je(r, z, D, te) {
      var re;
      try {
        re = se(z, D, D + te);
      } catch (z) {
        throw Ne(r, z), z;
      }
      Oe(r, re, 0, te);
    }
    function ke(r, z) {
      z.bytesFilled > 0 && je(r, z.buffer, z.byteOffset, z.bytesFilled), Me(r);
    }
    function Ae(r, z) {
      var D = Math.min(r._queueTotalSize, z.byteLength - z.bytesFilled),
        te = z.bytesFilled + D;
      var re = D,
        oe = false;
      var de = te - te % z.elementSize;
      de >= z.minimumFill && (re = de - z.bytesFilled, oe = true);
      var me = r._queue;
      for (; re > 0;) {
        var _D4 = me.peek(),
          _te3 = Math.min(re, _D4.byteLength),
          _oe = z.byteOffset + z.bytesFilled;
        ae(z.buffer, _oe, _D4.buffer, _D4.byteOffset, _te3), _D4.byteLength === _te3 ? me.shift() : (_D4.byteOffset += _te3, _D4.byteLength -= _te3), r._queueTotalSize -= _te3, ze(r, _te3, z), re -= _te3;
      }
      return oe;
    }
    function ze(r, z, D) {
      D.bytesFilled += z;
    }
    function De(r) {
      0 === r._queueTotalSize && r._closeRequested ? (Ye(r), Or(r._controlledReadableByteStream)) : Pe(r);
    }
    function Le(r) {
      null !== r._byobRequest && (r._byobRequest._associatedReadableByteStreamController = undefined, r._byobRequest._view = null, r._byobRequest = null);
    }
    function Fe(r) {
      var z = [];
      for (; r._pendingPullIntos.length > 0 && 0 !== r._queueTotalSize;) {
        var _D5 = r._pendingPullIntos.peek();
        Ae(r, _D5) && (Me(r), z.push(_D5));
      }
      return z;
    }
    function $e(r, z) {
      var D = r._pendingPullIntos.peek();
      Le(r), "closed" === r._controlledReadableByteStream._state ? function (r, z) {
        "none" === z.readerType && Me(r);
        var D = r._controlledReadableByteStream;
        if (nt(D)) {
          var _z2 = [];
          for (var _te4 = 0; _te4 < ot(D); ++_te4) _z2.push(Me(r));
          We(D, _z2);
        }
      }(r, D) : function (r, z, D) {
        if (ze(0, z, D), "none" === D.readerType) {
          ke(r, D);
          var _z3 = Fe(r);
          return void We(r._controlledReadableByteStream, _z3);
        }
        if (D.bytesFilled < D.minimumFill) return;
        Me(r);
        var te = D.bytesFilled % D.elementSize;
        if (te > 0) {
          var _z4 = D.byteOffset + D.bytesFilled;
          je(r, D.buffer, _z4 - te, te);
        }
        D.bytesFilled -= te;
        var re = Fe(r);
        Ee(r._controlledReadableByteStream, D), We(r._controlledReadableByteStream, re);
      }(r, z, D), Pe(r);
    }
    function Me(r) {
      return r._pendingPullIntos.shift();
    }
    function Ye(r) {
      r._pullAlgorithm = undefined, r._cancelAlgorithm = undefined;
    }
    function Qe(r) {
      var z = r._controlledReadableByteStream;
      if (!r._closeRequested && "readable" === z._state) if (r._queueTotalSize > 0) r._closeRequested = true;else {
        if (r._pendingPullIntos.length > 0) {
          var _z5 = r._pendingPullIntos.peek();
          if (_z5.bytesFilled % _z5.elementSize != 0) {
            var _z6 = new TypeError("Insufficient bytes to fill elements in the given buffer");
            throw Ne(r, _z6), _z6;
          }
        }
        Ye(r), Or(z);
      }
    }
    function xe(r, z) {
      var D = r._controlledReadableByteStream;
      if (r._closeRequested || "readable" !== D._state) return;
      var {
        buffer: te,
        byteOffset: re,
        byteLength: oe
      } = z;
      if (le(te)) throw new TypeError("chunk's buffer is detached and so cannot be enqueued");
      var de = ie(te);
      if (r._pendingPullIntos.length > 0) {
        var _z7 = r._pendingPullIntos.peek();
        if (le(_z7.buffer)) throw new TypeError("The BYOB request's buffer has been detached and so cannot be filled with an enqueued chunk");
        Le(r), _z7.buffer = ie(_z7.buffer), "none" === _z7.readerType && ke(r, _z7);
      }
      if (X(D)) (function (r) {
        var z = r._controlledReadableByteStream._reader;
        for (; z._readRequests.length > 0;) {
          if (0 === r._queueTotalSize) return;
          He(r, z._readRequests.shift());
        }
      })(r), 0 === G(D) ? Oe(r, de, re, oe) : (r._pendingPullIntos.length > 0 && Me(r), U(D, new Uint8Array(de, re, oe), false));else if (nt(D)) {
        Oe(r, de, re, oe);
        var _z8 = Fe(r);
        We(r._controlledReadableByteStream, _z8);
      } else Oe(r, de, re, oe);
      Pe(r);
    }
    function Ne(r, z) {
      var D = r._controlledReadableByteStream;
      "readable" === D._state && (qe(r), we(r), Ye(r), jr(D, z));
    }
    function He(r, z) {
      var D = r._queue.shift();
      r._queueTotalSize -= D.byteLength, De(r);
      var te = new Uint8Array(D.buffer, D.byteOffset, D.byteLength);
      z._chunkSteps(te);
    }
    function Ve(r) {
      if (null === r._byobRequest && r._pendingPullIntos.length > 0) {
        var _z9 = r._pendingPullIntos.peek(),
          _D6 = new Uint8Array(_z9.buffer, _z9.byteOffset + _z9.bytesFilled, _z9.byteLength - _z9.bytesFilled),
          _te5 = Object.create(_o.prototype);
        !function (r, z, D) {
          r._associatedReadableByteStreamController = z, r._view = D;
        }(_te5, r, _D6), r._byobRequest = _te5;
      }
      return r._byobRequest;
    }
    function Ue(r) {
      var z = r._controlledReadableByteStream._state;
      return "errored" === z ? null : "closed" === z ? 0 : r._strategyHWM - r._queueTotalSize;
    }
    function Ge(r, z) {
      var D = r._pendingPullIntos.peek();
      if ("closed" === r._controlledReadableByteStream._state) {
        if (0 !== z) throw new TypeError("bytesWritten must be 0 when calling respond() on a closed stream");
      } else {
        if (0 === z) throw new TypeError("bytesWritten must be greater than 0 when calling respond() on a readable stream");
        if (D.bytesFilled + z > D.byteLength) throw new RangeError("bytesWritten out of range");
      }
      D.buffer = ie(D.buffer), $e(r, z);
    }
    function Xe(r, z) {
      var D = r._pendingPullIntos.peek();
      if ("closed" === r._controlledReadableByteStream._state) {
        if (0 !== z.byteLength) throw new TypeError("The view's length must be 0 when calling respondWithNewView() on a closed stream");
      } else if (0 === z.byteLength) throw new TypeError("The view's length must be greater than 0 when calling respondWithNewView() on a readable stream");
      if (D.byteOffset + D.bytesFilled !== z.byteOffset) throw new RangeError("The region specified by view does not match byobRequest");
      if (D.bufferByteLength !== z.buffer.byteLength) throw new RangeError("The buffer of view has different capacity than byobRequest");
      if (D.bytesFilled + z.byteLength > D.byteLength) throw new RangeError("The region specified by view is larger than byobRequest");
      var te = z.byteLength;
      D.buffer = ie(z.buffer), $e(r, te);
    }
    function Je(r, z, D, te, re, oe, me) {
      z._controlledReadableByteStream = r, z._pullAgain = false, z._pulling = false, z._byobRequest = null, z._queue = z._queueTotalSize = undefined, we(z), z._closeRequested = false, z._started = false, z._strategyHWM = oe, z._pullAlgorithm = te, z._cancelAlgorithm = re, z._autoAllocateChunkSize = me, z._pendingPullIntos = new de(), r._readableStreamController = z, b(c(D()), () => (z._started = true, Pe(z), null), r => (Ne(z, r), null));
    }
    function Ke(r) {
      return new TypeError(`ReadableStreamBYOBRequest.prototype.${r} can only be used on a ReadableStreamBYOBRequest`);
    }
    function Ze(r) {
      return new TypeError(`ReadableByteStreamController.prototype.${r} can only be used on a ReadableByteStreamController`);
    }
    function et(r, z) {
      if ("byob" != (r = `${r}`)) throw new TypeError(`${z} '${r}' is not a valid enumeration value for ReadableStreamReaderMode`);
      return r;
    }
    function tt(r) {
      return new po(r);
    }
    function rt(r, z) {
      r._reader._readIntoRequests.push(z);
    }
    function ot(r) {
      return r._reader._readIntoRequests.length;
    }
    function nt(r) {
      var z = r._reader;
      return undefined !== z && !!at(z);
    }
    Object.defineProperties(mo.prototype, {
      close: {
        enumerable: true
      },
      enqueue: {
        enumerable: true
      },
      error: {
        enumerable: true
      },
      byobRequest: {
        enumerable: true
      },
      desiredSize: {
        enumerable: true
      }
    }), o(mo.prototype.close, "close"), o(mo.prototype.enqueue, "enqueue"), o(mo.prototype.error, "error"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(mo.prototype, Symbol.toStringTag, {
      value: "ReadableByteStreamController",
      configurable: true
    });
    var po = function () {
      return _createClass(function ReadableStreamBYOBReader(r) {
        if (_classCallCheck(this, ReadableStreamBYOBReader), $(r, 1, "ReadableStreamBYOBReader"), N(r, "First parameter"), Wr(r)) throw new TypeError("This stream has already been locked for exclusive reading by another reader");
        if (!Te(r._readableStreamController)) throw new TypeError("Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source");
        q(this, r), this._readIntoRequests = new de();
      }, [{
        key: "closed",
        get: function () {
          return at(this) ? this._closedPromise : d(st("closed"));
        }
      }, {
        key: "cancel",
        value: function cancel(r = undefined) {
          return at(this) ? undefined === this._ownerReadableStream ? d(B("cancel")) : E(this, r) : d(st("cancel"));
        }
      }, {
        key: "read",
        value: function read(r, z = {}) {
          if (!at(this)) return d(st("read"));
          if (!ArrayBuffer.isView(r)) return d(new TypeError("view must be an array buffer view"));
          if (0 === r.byteLength) return d(new TypeError("view must have non-zero byteLength"));
          if (0 === r.buffer.byteLength) return d(new TypeError("view's buffer must have non-zero byteLength"));
          if (le(r.buffer)) return d(new TypeError("view's buffer has been detached"));
          var D;
          try {
            D = function (r, z) {
              var D;
              return L(r, z), {
                min: x(null !== (D = null == r ? undefined : r.min) && undefined !== D ? D : 1, `${z} has member 'min' that`)
              };
            }(z, "options");
          } catch (r) {
            return d(r);
          }
          var te = D.min;
          if (0 === te) return d(new TypeError("options.min must be greater than 0"));
          if (function (r) {
            return Re(r.constructor);
          }(r)) {
            if (te > r.byteLength) return d(new RangeError("options.min must be less than or equal to view's byteLength"));
          } else if (te > r.length) return d(new RangeError("options.min must be less than or equal to view's length"));
          if (undefined === this._ownerReadableStream) return d(B("read from"));
          var re, oe;
          var de = u((r, z) => {
            re = r, oe = z;
          });
          return it(this, r, te, {
            _chunkSteps: r => re({
              value: r,
              done: false
            }),
            _closeSteps: r => re({
              value: r,
              done: true
            }),
            _errorSteps: r => oe(r)
          }), de;
        }
      }, {
        key: "releaseLock",
        value: function releaseLock() {
          if (!at(this)) throw st("releaseLock");
          undefined !== this._ownerReadableStream && function (r) {
            W(r);
            lt(r, new TypeError("Reader was released"));
          }(this);
        }
      }]);
    }();
    function at(r) {
      return !!t(r) && !!Object.prototype.hasOwnProperty.call(r, "_readIntoRequests") && r instanceof po;
    }
    function it(r, z, D, te) {
      var re = r._ownerReadableStream;
      re._disturbed = true, "errored" === re._state ? te._errorSteps(re._storedError) : function Ie(r, z, D, te) {
        var re = r._controlledReadableByteStream,
          oe = z.constructor,
          de = function (r) {
            return Re(r) ? 1 : r.BYTES_PER_ELEMENT;
          }(oe),
          {
            byteOffset: me,
            byteLength: ye
          } = z,
          Dt = D * de;
        var nr;
        try {
          nr = ie(z.buffer);
        } catch (r) {
          return void te._errorSteps(r);
        }
        var ar = {
          buffer: nr,
          bufferByteLength: nr.byteLength,
          byteOffset: me,
          byteLength: ye,
          bytesFilled: 0,
          minimumFill: Dt,
          elementSize: de,
          viewConstructor: oe,
          readerType: "byob"
        };
        if (r._pendingPullIntos.length > 0) return r._pendingPullIntos.push(ar), void rt(re, te);
        if ("closed" !== re._state) {
          if (r._queueTotalSize > 0) {
            if (Ae(r, ar)) {
              var _z0 = Be(ar);
              return De(r), void te._chunkSteps(_z0);
            }
            if (r._closeRequested) {
              var _z1 = new TypeError("Insufficient bytes to fill elements in the given buffer");
              return Ne(r, _z1), void te._errorSteps(_z1);
            }
          }
          r._pendingPullIntos.push(ar), rt(re, te), Pe(r);
        } else {
          var _r4 = new oe(ar.buffer, ar.byteOffset, 0);
          te._closeSteps(_r4);
        }
      }(re._readableStreamController, z, D, te);
    }
    function lt(r, z) {
      var D = r._readIntoRequests;
      r._readIntoRequests = new de(), D.forEach(r => {
        r._errorSteps(z);
      });
    }
    function st(r) {
      return new TypeError(`ReadableStreamBYOBReader.prototype.${r} can only be used on a ReadableStreamBYOBReader`);
    }
    function ut(r, z) {
      var {
        highWaterMark: D
      } = r;
      if (undefined === D) return z;
      if (bo(D) || D < 0) throw new RangeError("Invalid highWaterMark");
      return D;
    }
    function ct(r) {
      var {
        size: z
      } = r;
      return z || (() => 1);
    }
    function dt(r, z) {
      L(r, z);
      var D = null == r ? undefined : r.highWaterMark,
        te = null == r ? undefined : r.size;
      return {
        highWaterMark: undefined === D ? undefined : Y(D),
        size: undefined === te ? undefined : ft(te, `${z} has member 'size' that`)
      };
    }
    function ft(r, z) {
      return F(r, z), z => Y(r(z));
    }
    function bt(r, z, D) {
      return F(r, D), D => g(r, z, [D]);
    }
    function ht(r, z, D) {
      return F(r, D), () => g(r, z, []);
    }
    function mt(r, z, D) {
      return F(r, D), D => S(r, z, [D]);
    }
    function _t(r, z, D) {
      return F(r, D), (D, te) => g(r, z, [D, te]);
    }
    function pt(r, z) {
      if (!gt(r)) throw new TypeError(`${z} is not a WritableStream.`);
    }
    Object.defineProperties(po.prototype, {
      cancel: {
        enumerable: true
      },
      read: {
        enumerable: true
      },
      releaseLock: {
        enumerable: true
      },
      closed: {
        enumerable: true
      }
    }), o(po.prototype.cancel, "cancel"), o(po.prototype.read, "read"), o(po.prototype.releaseLock, "releaseLock"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(po.prototype, Symbol.toStringTag, {
      value: "ReadableStreamBYOBReader",
      configurable: true
    });
    var yo = function () {
      return _createClass(function WritableStream(r = {}, z = {}) {
        _classCallCheck(this, WritableStream), undefined === r ? r = null : I(r, "First parameter");
        var D = dt(z, "Second parameter"),
          te = function (r, z) {
            L(r, z);
            var D = null == r ? undefined : r.abort,
              te = null == r ? undefined : r.close,
              re = null == r ? undefined : r.start,
              oe = null == r ? undefined : r.type,
              de = null == r ? undefined : r.write;
            return {
              abort: undefined === D ? undefined : bt(D, r, `${z} has member 'abort' that`),
              close: undefined === te ? undefined : ht(te, r, `${z} has member 'close' that`),
              start: undefined === re ? undefined : mt(re, r, `${z} has member 'start' that`),
              write: undefined === de ? undefined : _t(de, r, `${z} has member 'write' that`),
              type: oe
            };
          }(r, "First parameter");
        if (St(this), undefined !== te.type) throw new RangeError("Invalid type is specified");
        var re = ct(D);
        !function (r, z, D, te) {
          var re = Object.create(So.prototype);
          var oe, de, me, ye;
          oe = undefined !== z.start ? () => z.start(re) : () => {}, de = undefined !== z.write ? r => z.write(r, re) : () => c(undefined), me = undefined !== z.close ? () => z.close() : () => c(undefined), ye = undefined !== z.abort ? r => z.abort(r) : () => c(undefined), Ft(r, re, oe, de, me, ye, D, te);
        }(this, te, ut(D, 1), re);
      }, [{
        key: "locked",
        get: function () {
          if (!gt(this)) throw Nt("locked");
          return vt(this);
        }
      }, {
        key: "abort",
        value: function abort(r = undefined) {
          return gt(this) ? vt(this) ? d(new TypeError("Cannot abort a stream that already has a writer")) : wt(this, r) : d(Nt("abort"));
        }
      }, {
        key: "close",
        value: function close() {
          return gt(this) ? vt(this) ? d(new TypeError("Cannot close a stream that already has a writer")) : qt(this) ? d(new TypeError("Cannot close an already-closing stream")) : Rt(this) : d(Nt("close"));
        }
      }, {
        key: "getWriter",
        value: function getWriter() {
          if (!gt(this)) throw Nt("getWriter");
          return yt(this);
        }
      }]);
    }();
    function yt(r) {
      return new vo(r);
    }
    function St(r) {
      r._state = "writable", r._storedError = undefined, r._writer = undefined, r._writableStreamController = undefined, r._writeRequests = new de(), r._inFlightWriteRequest = undefined, r._closeRequest = undefined, r._inFlightCloseRequest = undefined, r._pendingAbortRequest = undefined, r._backpressure = false;
    }
    function gt(r) {
      return !!t(r) && !!Object.prototype.hasOwnProperty.call(r, "_writableStreamController") && r instanceof yo;
    }
    function vt(r) {
      return undefined !== r._writer;
    }
    function wt(r, z) {
      var D;
      if ("closed" === r._state || "errored" === r._state) return c(undefined);
      r._writableStreamController._abortReason = z, null === (D = r._writableStreamController._abortController) || undefined === D || D.abort(z);
      var te = r._state;
      if ("closed" === te || "errored" === te) return c(undefined);
      if (undefined !== r._pendingAbortRequest) return r._pendingAbortRequest._promise;
      var re = false;
      "erroring" === te && (re = true, z = undefined);
      var oe = u((D, te) => {
        r._pendingAbortRequest = {
          _promise: undefined,
          _resolve: D,
          _reject: te,
          _reason: z,
          _wasAlreadyErroring: re
        };
      });
      return r._pendingAbortRequest._promise = oe, re || Ct(r, z), oe;
    }
    function Rt(r) {
      var z = r._state;
      if ("closed" === z || "errored" === z) return d(new TypeError(`The stream (in ${z} state) is not in the writable state and cannot be closed`));
      var D = u((z, D) => {
          var te = {
            _resolve: z,
            _reject: D
          };
          r._closeRequest = te;
        }),
        te = r._writer;
      var re;
      return undefined !== te && r._backpressure && "writable" === z && or(te), ve(re = r._writableStreamController, go, 0), Mt(re), D;
    }
    function Tt(r, z) {
      "writable" !== r._state ? Pt(r) : Ct(r, z);
    }
    function Ct(r, z) {
      var D = r._writableStreamController;
      r._state = "erroring", r._storedError = z;
      var te = r._writer;
      undefined !== te && kt(te, z), !function (r) {
        return undefined !== r._inFlightWriteRequest || undefined !== r._inFlightCloseRequest;
      }(r) && D._started && Pt(r);
    }
    function Pt(r) {
      r._state = "errored", r._writableStreamController[ye]();
      var z = r._storedError;
      if (r._writeRequests.forEach(r => {
        r._reject(z);
      }), r._writeRequests = new de(), undefined === r._pendingAbortRequest) return void Et(r);
      var D = r._pendingAbortRequest;
      if (r._pendingAbortRequest = undefined, D._wasAlreadyErroring) return D._reject(z), void Et(r);
      b(r._writableStreamController[me](D._reason), () => (D._resolve(), Et(r), null), z => (D._reject(z), Et(r), null));
    }
    function qt(r) {
      return undefined !== r._closeRequest || undefined !== r._inFlightCloseRequest;
    }
    function Et(r) {
      undefined !== r._closeRequest && (r._closeRequest._reject(r._storedError), r._closeRequest = undefined);
      var z = r._writer;
      undefined !== z && Jt(z, r._storedError);
    }
    function Wt(r, z) {
      var D = r._writer;
      undefined !== D && z !== r._backpressure && (z ? function (r) {
        Zt(r);
      }(D) : or(D)), r._backpressure = z;
    }
    Object.defineProperties(yo.prototype, {
      abort: {
        enumerable: true
      },
      close: {
        enumerable: true
      },
      getWriter: {
        enumerable: true
      },
      locked: {
        enumerable: true
      }
    }), o(yo.prototype.abort, "abort"), o(yo.prototype.close, "close"), o(yo.prototype.getWriter, "getWriter"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(yo.prototype, Symbol.toStringTag, {
      value: "WritableStream",
      configurable: true
    });
    var vo = function () {
      return _createClass(function WritableStreamDefaultWriter(r) {
        if (_classCallCheck(this, WritableStreamDefaultWriter), $(r, 1, "WritableStreamDefaultWriter"), pt(r, "First parameter"), vt(r)) throw new TypeError("This stream has already been locked for exclusive writing by another writer");
        this._ownerWritableStream = r, r._writer = this;
        var z = r._state;
        if ("writable" === z) !qt(r) && r._backpressure ? Zt(this) : tr(this), Gt(this);else if ("erroring" === z) er(this, r._storedError), Gt(this);else if ("closed" === z) tr(this), Gt(this), Kt(this);else {
          var _z10 = r._storedError;
          er(this, _z10), Xt(this, _z10);
        }
      }, [{
        key: "closed",
        get: function () {
          return Bt(this) ? this._closedPromise : d(Vt("closed"));
        }
      }, {
        key: "desiredSize",
        get: function () {
          if (!Bt(this)) throw Vt("desiredSize");
          if (undefined === this._ownerWritableStream) throw Ut("desiredSize");
          return function (r) {
            var z = r._ownerWritableStream,
              D = z._state;
            return "errored" === D || "erroring" === D ? null : "closed" === D ? 0 : $t(z._writableStreamController);
          }(this);
        }
      }, {
        key: "ready",
        get: function () {
          return Bt(this) ? this._readyPromise : d(Vt("ready"));
        }
      }, {
        key: "abort",
        value: function abort(r = undefined) {
          return Bt(this) ? undefined === this._ownerWritableStream ? d(Ut("abort")) : function (r, z) {
            return wt(r._ownerWritableStream, z);
          }(this, r) : d(Vt("abort"));
        }
      }, {
        key: "close",
        value: function close() {
          if (!Bt(this)) return d(Vt("close"));
          var r = this._ownerWritableStream;
          return undefined === r ? d(Ut("close")) : qt(r) ? d(new TypeError("Cannot close an already-closing stream")) : Ot(this);
        }
      }, {
        key: "releaseLock",
        value: function releaseLock() {
          if (!Bt(this)) throw Vt("releaseLock");
          undefined !== this._ownerWritableStream && At(this);
        }
      }, {
        key: "write",
        value: function write(r = undefined) {
          return Bt(this) ? undefined === this._ownerWritableStream ? d(Ut("write to")) : zt(this, r) : d(Vt("write"));
        }
      }]);
    }();
    function Bt(r) {
      return !!t(r) && !!Object.prototype.hasOwnProperty.call(r, "_ownerWritableStream") && r instanceof vo;
    }
    function Ot(r) {
      return Rt(r._ownerWritableStream);
    }
    function kt(r, z) {
      "pending" === r._readyPromiseState ? rr(r, z) : function (r, z) {
        er(r, z);
      }(r, z);
    }
    function At(r) {
      var z = r._ownerWritableStream,
        D = new TypeError("Writer was released and can no longer be used to monitor the stream's closedness");
      kt(r, D), function jt(r, z) {
        "pending" === r._closedPromiseState ? Jt(r, z) : function (r, z) {
          Xt(r, z);
        }(r, z);
      }(r, D), z._writer = undefined, r._ownerWritableStream = undefined;
    }
    function zt(r, z) {
      var D = r._ownerWritableStream,
        te = D._writableStreamController,
        re = function (r, z) {
          if (undefined === r._strategySizeAlgorithm) return 1;
          try {
            return r._strategySizeAlgorithm(z);
          } catch (z) {
            return Yt(r, z), 1;
          }
        }(te, z);
      if (D !== r._ownerWritableStream) return d(Ut("write to"));
      var oe = D._state;
      if ("errored" === oe) return d(D._storedError);
      if (qt(D) || "closed" === oe) return d(new TypeError("The stream is closing or closed and cannot be written to"));
      if ("erroring" === oe) return d(D._storedError);
      var de = function (r) {
        return u((z, D) => {
          var te = {
            _resolve: z,
            _reject: D
          };
          r._writeRequests.push(te);
        });
      }(D);
      return function (r, z, D) {
        try {
          ve(r, z, D);
        } catch (z) {
          return void Yt(r, z);
        }
        var te = r._controlledWritableStream;
        qt(te) || "writable" !== te._state || Wt(te, Qt(r)), Mt(r);
      }(te, z, re), de;
    }
    Object.defineProperties(vo.prototype, {
      abort: {
        enumerable: true
      },
      close: {
        enumerable: true
      },
      releaseLock: {
        enumerable: true
      },
      write: {
        enumerable: true
      },
      closed: {
        enumerable: true
      },
      desiredSize: {
        enumerable: true
      },
      ready: {
        enumerable: true
      }
    }), o(vo.prototype.abort, "abort"), o(vo.prototype.close, "close"), o(vo.prototype.releaseLock, "releaseLock"), o(vo.prototype.write, "write"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(vo.prototype, Symbol.toStringTag, {
      value: "WritableStreamDefaultWriter",
      configurable: true
    });
    var go = {};
    var So = function () {
      return _createClass(function WritableStreamDefaultController() {
        throw _classCallCheck(this, WritableStreamDefaultController), new TypeError("Illegal constructor");
      }, [{
        key: "abortReason",
        get: function () {
          if (!Lt(this)) throw Ht("abortReason");
          return this._abortReason;
        }
      }, {
        key: "signal",
        get: function () {
          if (!Lt(this)) throw Ht("signal");
          if (undefined === this._abortController) throw new TypeError("WritableStreamDefaultController.prototype.signal is not supported");
          return this._abortController.signal;
        }
      }, {
        key: "error",
        value: function error(r = undefined) {
          if (!Lt(this)) throw Ht("error");
          "writable" === this._controlledWritableStream._state && xt(this, r);
        }
      }, {
        key: me,
        value: function (r) {
          var z = this._abortAlgorithm(r);
          return It(this), z;
        }
      }, {
        key: ye,
        value: function () {
          we(this);
        }
      }]);
    }();
    function Lt(r) {
      return !!t(r) && !!Object.prototype.hasOwnProperty.call(r, "_controlledWritableStream") && r instanceof So;
    }
    function Ft(r, z, D, te, re, oe, de, me) {
      z._controlledWritableStream = r, r._writableStreamController = z, z._queue = undefined, z._queueTotalSize = undefined, we(z), z._abortReason = undefined, z._abortController = function () {
        if ("function" == typeof AbortController) return new AbortController();
      }(), z._started = false, z._strategySizeAlgorithm = me, z._strategyHWM = de, z._writeAlgorithm = te, z._closeAlgorithm = re, z._abortAlgorithm = oe;
      var ye = Qt(z);
      Wt(r, ye), b(c(D()), () => (z._started = true, Mt(z), null), D => (z._started = true, Tt(r, D), null));
    }
    function It(r) {
      r._writeAlgorithm = undefined, r._closeAlgorithm = undefined, r._abortAlgorithm = undefined, r._strategySizeAlgorithm = undefined;
    }
    function $t(r) {
      return r._strategyHWM - r._queueTotalSize;
    }
    function Mt(r) {
      var z = r._controlledWritableStream;
      if (!r._started) return;
      if (undefined !== z._inFlightWriteRequest) return;
      if ("erroring" === z._state) return void Pt(z);
      if (0 === r._queue.length) return;
      var D = r._queue.peek().value;
      D === go ? function (r) {
        var z = r._controlledWritableStream;
        (function (r) {
          r._inFlightCloseRequest = r._closeRequest, r._closeRequest = undefined;
        })(z), ge(r);
        var D = r._closeAlgorithm();
        It(r), b(D, () => (function (r) {
          r._inFlightCloseRequest._resolve(undefined), r._inFlightCloseRequest = undefined, "erroring" === r._state && (r._storedError = undefined, undefined !== r._pendingAbortRequest && (r._pendingAbortRequest._resolve(), r._pendingAbortRequest = undefined)), r._state = "closed";
          var z = r._writer;
          undefined !== z && Kt(z);
        }(z), null), r => (function (r, z) {
          r._inFlightCloseRequest._reject(z), r._inFlightCloseRequest = undefined, undefined !== r._pendingAbortRequest && (r._pendingAbortRequest._reject(z), r._pendingAbortRequest = undefined), Tt(r, z);
        }(z, r), null));
      }(r) : function (r, z) {
        var D = r._controlledWritableStream;
        !function (r) {
          r._inFlightWriteRequest = r._writeRequests.shift();
        }(D);
        b(r._writeAlgorithm(z), () => {
          !function (r) {
            r._inFlightWriteRequest._resolve(undefined), r._inFlightWriteRequest = undefined;
          }(D);
          var z = D._state;
          if (ge(r), !qt(D) && "writable" === z) {
            var _z11 = Qt(r);
            Wt(D, _z11);
          }
          return Mt(r), null;
        }, z => ("writable" === D._state && It(r), function (r, z) {
          r._inFlightWriteRequest._reject(z), r._inFlightWriteRequest = undefined, Tt(r, z);
        }(D, z), null));
      }(r, D);
    }
    function Yt(r, z) {
      "writable" === r._controlledWritableStream._state && xt(r, z);
    }
    function Qt(r) {
      return $t(r) <= 0;
    }
    function xt(r, z) {
      var D = r._controlledWritableStream;
      It(r), Ct(D, z);
    }
    function Nt(r) {
      return new TypeError(`WritableStream.prototype.${r} can only be used on a WritableStream`);
    }
    function Ht(r) {
      return new TypeError(`WritableStreamDefaultController.prototype.${r} can only be used on a WritableStreamDefaultController`);
    }
    function Vt(r) {
      return new TypeError(`WritableStreamDefaultWriter.prototype.${r} can only be used on a WritableStreamDefaultWriter`);
    }
    function Ut(r) {
      return new TypeError("Cannot " + r + " a stream using a released writer");
    }
    function Gt(r) {
      r._closedPromise = u((z, D) => {
        r._closedPromise_resolve = z, r._closedPromise_reject = D, r._closedPromiseState = "pending";
      });
    }
    function Xt(r, z) {
      Gt(r), Jt(r, z);
    }
    function Jt(r, z) {
      undefined !== r._closedPromise_reject && (p(r._closedPromise), r._closedPromise_reject(z), r._closedPromise_resolve = undefined, r._closedPromise_reject = undefined, r._closedPromiseState = "rejected");
    }
    function Kt(r) {
      undefined !== r._closedPromise_resolve && (r._closedPromise_resolve(undefined), r._closedPromise_resolve = undefined, r._closedPromise_reject = undefined, r._closedPromiseState = "resolved");
    }
    function Zt(r) {
      r._readyPromise = u((z, D) => {
        r._readyPromise_resolve = z, r._readyPromise_reject = D;
      }), r._readyPromiseState = "pending";
    }
    function er(r, z) {
      Zt(r), rr(r, z);
    }
    function tr(r) {
      Zt(r), or(r);
    }
    function rr(r, z) {
      undefined !== r._readyPromise_reject && (p(r._readyPromise), r._readyPromise_reject(z), r._readyPromise_resolve = undefined, r._readyPromise_reject = undefined, r._readyPromiseState = "rejected");
    }
    function or(r) {
      undefined !== r._readyPromise_resolve && (r._readyPromise_resolve(undefined), r._readyPromise_resolve = undefined, r._readyPromise_reject = undefined, r._readyPromiseState = "fulfilled");
    }
    Object.defineProperties(So.prototype, {
      abortReason: {
        enumerable: true
      },
      signal: {
        enumerable: true
      },
      error: {
        enumerable: true
      }
    }), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(So.prototype, Symbol.toStringTag, {
      value: "WritableStreamDefaultController",
      configurable: true
    });
    var wo = "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : "undefined" != typeof global ? global : undefined,
      Ro = function () {
        var r = null == wo ? undefined : wo.DOMException;
        return function (r) {
          if ("function" != typeof r && "object" != typeof r) return false;
          if ("DOMException" !== r.name) return false;
          try {
            return new r(), true;
          } catch (r) {
            return false;
          }
        }(r) ? r : undefined;
      }() || function () {
        var e = function (r, z) {
          this.message = r || "", this.name = z || "Error", Error.captureStackTrace && Error.captureStackTrace(this, this.constructor);
        };
        return o(e, "DOMException"), e.prototype = Object.create(Error.prototype), Object.defineProperty(e.prototype, "constructor", {
          value: e,
          writable: true,
          configurable: true
        }), e;
      }();
    function ir(r, z, D, te, re, oe) {
      var de = H(r),
        me = yt(z);
      r._disturbed = true;
      var ye = false,
        Dt = c(undefined);
      return u((nr, ar) => {
        var no;
        if (undefined !== oe) {
          if (no = () => {
            var D = undefined !== oe.reason ? oe.reason : new Ro("Aborted", "AbortError"),
              de = [];
            te || de.push(() => "writable" === z._state ? wt(z, D) : c(undefined)), re || de.push(() => "readable" === r._state ? Br(r, D) : c(undefined)), q(() => Promise.all(de.map(r => r())), true, D);
          }, oe.aborted) return void no();
          oe.addEventListener("abort", no);
        }
        var io, ao, lo;
        if (P(r, de._closedPromise, r => (te ? E(true, r) : q(() => wt(z, r), true, r), null)), P(z, me._closedPromise, z => (re ? E(true, z) : q(() => Br(r, z), true, z), null)), io = r, ao = de._closedPromise, lo = () => (D ? E() : q(() => function (r) {
          var z = r._ownerWritableStream,
            D = z._state;
          return qt(z) || "closed" === D ? c(undefined) : "errored" === D ? d(z._storedError) : Ot(r);
        }(me)), null), "closed" === io._state ? lo() : h(ao, lo), qt(z) || "closed" === z._state) {
          var _z12 = new TypeError("the destination writable stream closed before all data could be piped to it");
          re ? E(true, _z12) : q(() => Br(r, _z12), true, _z12);
        }
        function C() {
          var r = Dt;
          return f(Dt, () => r !== Dt ? C() : undefined);
        }
        function P(r, z, D) {
          "errored" === r._state ? D(r._storedError) : m(z, D);
        }
        function q(r, D, te) {
          function n() {
            return b(r(), () => B(D, te), r => B(true, r)), null;
          }
          ye || (ye = true, "writable" !== z._state || qt(z) ? n() : h(C(), n));
        }
        function E(r, D) {
          ye || (ye = true, "writable" !== z._state || qt(z) ? B(r, D) : h(C(), () => B(r, D)));
        }
        function B(r, z) {
          return At(me), W(de), undefined !== oe && oe.removeEventListener("abort", no), r ? ar(z) : nr(undefined), null;
        }
        p(u((r, z) => {
          !function o(D) {
            D ? r() : f(ye ? c(true) : f(me._readyPromise, () => u((r, z) => {
              K(de, {
                _chunkSteps: z => {
                  Dt = f(zt(me, z), undefined, e), r(false);
                },
                _closeSteps: () => r(true),
                _errorSteps: z
              });
            })), o, z);
          }(false);
        }));
      });
    }
    var To = function () {
      return _createClass(function ReadableStreamDefaultController() {
        throw _classCallCheck(this, ReadableStreamDefaultController), new TypeError("Illegal constructor");
      }, [{
        key: "desiredSize",
        get: function () {
          if (!lr(this)) throw pr("desiredSize");
          return hr(this);
        }
      }, {
        key: "close",
        value: function close() {
          if (!lr(this)) throw pr("close");
          if (!mr(this)) throw new TypeError("The stream is not in a state that permits close");
          dr(this);
        }
      }, {
        key: "enqueue",
        value: function enqueue(r = undefined) {
          if (!lr(this)) throw pr("enqueue");
          if (!mr(this)) throw new TypeError("The stream is not in a state that permits enqueue");
          return fr(this, r);
        }
      }, {
        key: "error",
        value: function error(r = undefined) {
          if (!lr(this)) throw pr("error");
          br(this, r);
        }
      }, {
        key: Dt,
        value: function (r) {
          we(this);
          var z = this._cancelAlgorithm(r);
          return cr(this), z;
        }
      }, {
        key: nr,
        value: function (r) {
          var z = this._controlledReadableStream;
          if (this._queue.length > 0) {
            var _D7 = ge(this);
            this._closeRequested && 0 === this._queue.length ? (cr(this), Or(z)) : sr(this), r._chunkSteps(_D7);
          } else V(z, r), sr(this);
        }
      }, {
        key: ar,
        value: function () {}
      }]);
    }();
    function lr(r) {
      return !!t(r) && !!Object.prototype.hasOwnProperty.call(r, "_controlledReadableStream") && r instanceof To;
    }
    function sr(r) {
      ur(r) && (r._pulling ? r._pullAgain = true : (r._pulling = true, b(r._pullAlgorithm(), () => (r._pulling = false, r._pullAgain && (r._pullAgain = false, sr(r)), null), z => (br(r, z), null))));
    }
    function ur(r) {
      var z = r._controlledReadableStream;
      return !!mr(r) && !!r._started && (!!(Wr(z) && G(z) > 0) || hr(r) > 0);
    }
    function cr(r) {
      r._pullAlgorithm = undefined, r._cancelAlgorithm = undefined, r._strategySizeAlgorithm = undefined;
    }
    function dr(r) {
      if (!mr(r)) return;
      var z = r._controlledReadableStream;
      r._closeRequested = true, 0 === r._queue.length && (cr(r), Or(z));
    }
    function fr(r, z) {
      if (!mr(r)) return;
      var D = r._controlledReadableStream;
      if (Wr(D) && G(D) > 0) U(D, z, false);else {
        var _D8;
        try {
          _D8 = r._strategySizeAlgorithm(z);
        } catch (z) {
          throw br(r, z), z;
        }
        try {
          ve(r, z, _D8);
        } catch (z) {
          throw br(r, z), z;
        }
      }
      sr(r);
    }
    function br(r, z) {
      var D = r._controlledReadableStream;
      "readable" === D._state && (we(r), cr(r), jr(D, z));
    }
    function hr(r) {
      var z = r._controlledReadableStream._state;
      return "errored" === z ? null : "closed" === z ? 0 : r._strategyHWM - r._queueTotalSize;
    }
    function mr(r) {
      var z = r._controlledReadableStream._state;
      return !r._closeRequested && "readable" === z;
    }
    function _r(r, z, D, te, re, oe, de) {
      z._controlledReadableStream = r, z._queue = undefined, z._queueTotalSize = undefined, we(z), z._started = false, z._closeRequested = false, z._pullAgain = false, z._pulling = false, z._strategySizeAlgorithm = de, z._strategyHWM = oe, z._pullAlgorithm = te, z._cancelAlgorithm = re, r._readableStreamController = z, b(c(D()), () => (z._started = true, sr(z), null), r => (br(z, r), null));
    }
    function pr(r) {
      return new TypeError(`ReadableStreamDefaultController.prototype.${r} can only be used on a ReadableStreamDefaultController`);
    }
    function Sr(r) {
      return t(z = r) && undefined !== z.getReader ? function (r) {
        var z;
        return z = Cr(e, function n() {
          var D;
          try {
            D = r.read();
          } catch (D) {
            return d(D);
          }
          return _(D, r => {
            if (!t(r)) throw new TypeError("The promise returned by the reader.read() method must fulfill with an object");
            if (r.done) dr(z._readableStreamController);else {
              var _D9 = r.value;
              fr(z._readableStreamController, _D9);
            }
          });
        }, function a(z) {
          try {
            return c(r.cancel(z));
          } catch (z) {
            return d(z);
          }
        }, 0), z;
      }(r.getReader()) : function (r) {
        var z;
        var D = fe(r, "async");
        return z = Cr(e, function a() {
          var r;
          try {
            r = be(D);
          } catch (r) {
            return d(r);
          }
          return _(c(r), r => {
            if (!t(r)) throw new TypeError("The promise returned by the iterator.next() method must fulfill with an object");
            if (r.done) dr(z._readableStreamController);else {
              var _D0 = r.value;
              fr(z._readableStreamController, _D0);
            }
          });
        }, function i(r) {
          var z = D.iterator;
          var te;
          try {
            te = ue(z, "return");
          } catch (r) {
            return d(r);
          }
          return undefined === te ? c(undefined) : _(g(te, z, [r]), r => {
            if (!t(r)) throw new TypeError("The promise returned by the iterator.return() method must fulfill with an object");
          });
        }, 0), z;
      }(r);
      var z;
    }
    function gr(r, z, D) {
      return F(r, D), D => g(r, z, [D]);
    }
    function vr(r, z, D) {
      return F(r, D), D => g(r, z, [D]);
    }
    function wr(r, z, D) {
      return F(r, D), D => S(r, z, [D]);
    }
    function Rr(r, z) {
      if ("bytes" != (r = `${r}`)) throw new TypeError(`${z} '${r}' is not a valid enumeration value for ReadableStreamType`);
      return r;
    }
    function Tr(r, z) {
      L(r, z);
      var D = null == r ? undefined : r.preventAbort,
        te = null == r ? undefined : r.preventCancel,
        re = null == r ? undefined : r.preventClose,
        oe = null == r ? undefined : r.signal;
      return undefined !== oe && function (r, z) {
        if (!function (r) {
          if ("object" != typeof r || null === r) return false;
          try {
            return "boolean" == typeof r.aborted;
          } catch (r) {
            return false;
          }
        }(r)) throw new TypeError(`${z} is not an AbortSignal.`);
      }(oe, `${z} has member 'signal' that`), {
        preventAbort: Boolean(D),
        preventCancel: Boolean(te),
        preventClose: Boolean(re),
        signal: oe
      };
    }
    Object.defineProperties(To.prototype, {
      close: {
        enumerable: true
      },
      enqueue: {
        enumerable: true
      },
      error: {
        enumerable: true
      },
      desiredSize: {
        enumerable: true
      }
    }), o(To.prototype.close, "close"), o(To.prototype.enqueue, "enqueue"), o(To.prototype.error, "error"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(To.prototype, Symbol.toStringTag, {
      value: "ReadableStreamDefaultController",
      configurable: true
    });
    var Co = function () {
      return _createClass(function ReadableStream(r = {}, z = {}) {
        _classCallCheck(this, ReadableStream), undefined === r ? r = null : I(r, "First parameter");
        var D = dt(z, "Second parameter"),
          te = function (r, z) {
            L(r, z);
            var D = r,
              te = null == D ? undefined : D.autoAllocateChunkSize,
              re = null == D ? undefined : D.cancel,
              oe = null == D ? undefined : D.pull,
              de = null == D ? undefined : D.start,
              me = null == D ? undefined : D.type;
            return {
              autoAllocateChunkSize: undefined === te ? undefined : x(te, `${z} has member 'autoAllocateChunkSize' that`),
              cancel: undefined === re ? undefined : gr(re, D, `${z} has member 'cancel' that`),
              pull: undefined === oe ? undefined : vr(oe, D, `${z} has member 'pull' that`),
              start: undefined === de ? undefined : wr(de, D, `${z} has member 'start' that`),
              type: undefined === me ? undefined : Rr(me, `${z} has member 'type' that`)
            };
          }(r, "First parameter");
        if (qr(this), "bytes" === te.type) {
          if (undefined !== D.size) throw new RangeError("The strategy for a byte stream cannot have a size function");
          !function (r, z, D) {
            var te = Object.create(mo.prototype);
            var re, oe, de;
            re = undefined !== z.start ? () => z.start(te) : () => {}, oe = undefined !== z.pull ? () => z.pull(te) : () => c(undefined), de = undefined !== z.cancel ? r => z.cancel(r) : () => c(undefined);
            var me = z.autoAllocateChunkSize;
            if (0 === me) throw new TypeError("autoAllocateChunkSize must be greater than 0");
            Je(r, te, re, oe, de, D, me);
          }(this, te, ut(D, 0));
        } else {
          var _r5 = ct(D);
          !function (r, z, D, te) {
            var re = Object.create(To.prototype);
            var oe, de, me;
            oe = undefined !== z.start ? () => z.start(re) : () => {}, de = undefined !== z.pull ? () => z.pull(re) : () => c(undefined), me = undefined !== z.cancel ? r => z.cancel(r) : () => c(undefined), _r(r, re, oe, de, me, D, te);
          }(this, te, ut(D, 1), _r5);
        }
      }, [{
        key: "locked",
        get: function () {
          if (!Er(this)) throw kr("locked");
          return Wr(this);
        }
      }, {
        key: "cancel",
        value: function cancel(r = undefined) {
          return Er(this) ? Wr(this) ? d(new TypeError("Cannot cancel a stream that already has a reader")) : Br(this, r) : d(kr("cancel"));
        }
      }, {
        key: "getReader",
        value: function getReader(r = undefined) {
          if (!Er(this)) throw kr("getReader");
          return undefined === function (r, z) {
            L(r, z);
            var D = null == r ? undefined : r.mode;
            return {
              mode: undefined === D ? undefined : et(D, `${z} has member 'mode' that`)
            };
          }(r, "First parameter").mode ? H(this) : tt(this);
        }
      }, {
        key: "pipeThrough",
        value: function pipeThrough(r, z = {}) {
          if (!Er(this)) throw kr("pipeThrough");
          $(r, 1, "pipeThrough");
          var D = function (r, z) {
              L(r, z);
              var D = null == r ? undefined : r.readable;
              M(D, "readable", "ReadableWritablePair"), N(D, `${z} has member 'readable' that`);
              var te = null == r ? undefined : r.writable;
              return M(te, "writable", "ReadableWritablePair"), pt(te, `${z} has member 'writable' that`), {
                readable: D,
                writable: te
              };
            }(r, "First parameter"),
            te = Tr(z, "Second parameter");
          if (Wr(this)) throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked ReadableStream");
          if (vt(D.writable)) throw new TypeError("ReadableStream.prototype.pipeThrough cannot be used on a locked WritableStream");
          return p(ir(this, D.writable, te.preventClose, te.preventAbort, te.preventCancel, te.signal)), D.readable;
        }
      }, {
        key: "pipeTo",
        value: function pipeTo(r, z = {}) {
          if (!Er(this)) return d(kr("pipeTo"));
          if (undefined === r) return d("Parameter 1 is required in 'pipeTo'.");
          if (!gt(r)) return d(new TypeError("ReadableStream.prototype.pipeTo's first argument must be a WritableStream"));
          var D;
          try {
            D = Tr(z, "Second parameter");
          } catch (r) {
            return d(r);
          }
          return Wr(this) ? d(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream")) : vt(r) ? d(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream")) : ir(this, r, D.preventClose, D.preventAbort, D.preventCancel, D.signal);
        }
      }, {
        key: "tee",
        value: function tee() {
          if (!Er(this)) throw kr("tee");
          return ne(function yr(r, z) {
            return Te(r._readableStreamController) ? function (r) {
              var z,
                D,
                te,
                re,
                oe,
                de = H(r),
                me = false,
                ye = false,
                Dt = false,
                nr = false,
                ar = false;
              var no = u(r => {
                oe = r;
              });
              function _(r) {
                m(r._closedPromise, z => (r !== de || (Ne(te._readableStreamController, z), Ne(re._readableStreamController, z), nr && ar || oe(undefined)), null));
              }
              function p() {
                at(de) && (W(de), de = H(r), _(de)), K(de, {
                  _chunkSteps: z => {
                    y(() => {
                      ye = false, Dt = false;
                      var D = z;
                      var de = z;
                      if (!nr && !ar) try {
                        de = Se(z);
                      } catch (z) {
                        return Ne(te._readableStreamController, z), Ne(re._readableStreamController, z), void oe(Br(r, z));
                      }
                      nr || xe(te._readableStreamController, D), ar || xe(re._readableStreamController, de), me = false, ye ? g() : Dt && v();
                    });
                  },
                  _closeSteps: () => {
                    me = false, nr || Qe(te._readableStreamController), ar || Qe(re._readableStreamController), te._readableStreamController._pendingPullIntos.length > 0 && Ge(te._readableStreamController, 0), re._readableStreamController._pendingPullIntos.length > 0 && Ge(re._readableStreamController, 0), nr && ar || oe(undefined);
                  },
                  _errorSteps: () => {
                    me = false;
                  }
                });
              }
              function S(z, D) {
                J(de) && (W(de), de = tt(r), _(de));
                var no = D ? re : te,
                  io = D ? te : re;
                it(de, z, 1, {
                  _chunkSteps: z => {
                    y(() => {
                      ye = false, Dt = false;
                      var te = D ? ar : nr;
                      if (D ? nr : ar) te || Xe(no._readableStreamController, z);else {
                        var _D1;
                        try {
                          _D1 = Se(z);
                        } catch (z) {
                          return Ne(no._readableStreamController, z), Ne(io._readableStreamController, z), void oe(Br(r, z));
                        }
                        te || Xe(no._readableStreamController, z), xe(io._readableStreamController, _D1);
                      }
                      me = false, ye ? g() : Dt && v();
                    });
                  },
                  _closeSteps: r => {
                    me = false;
                    var z = D ? ar : nr,
                      te = D ? nr : ar;
                    z || Qe(no._readableStreamController), te || Qe(io._readableStreamController), undefined !== r && (z || Xe(no._readableStreamController, r), !te && io._readableStreamController._pendingPullIntos.length > 0 && Ge(io._readableStreamController, 0)), z && te || oe(undefined);
                  },
                  _errorSteps: () => {
                    me = false;
                  }
                });
              }
              function g() {
                if (me) return ye = true, c(undefined);
                me = true;
                var r = Ve(te._readableStreamController);
                return null === r ? p() : S(r._view, false), c(undefined);
              }
              function v() {
                if (me) return Dt = true, c(undefined);
                me = true;
                var r = Ve(re._readableStreamController);
                return null === r ? p() : S(r._view, true), c(undefined);
              }
              function T() {}
              return te = Pr(T, g, function w(te) {
                if (nr = true, z = te, ar) {
                  var _te6 = ne([z, D]),
                    _re2 = Br(r, _te6);
                  oe(_re2);
                }
                return no;
              }), re = Pr(T, v, function R(te) {
                if (ar = true, D = te, nr) {
                  var _te7 = ne([z, D]),
                    _re3 = Br(r, _te7);
                  oe(_re3);
                }
                return no;
              }), _(de), [te, re];
            }(r) : function (r, z) {
              var D = H(r);
              var te,
                re,
                oe,
                de,
                me,
                ye = false,
                Dt = false,
                nr = false,
                ar = false;
              var no = u(r => {
                me = r;
              });
              function _() {
                return ye ? (Dt = true, c(undefined)) : (ye = true, K(D, {
                  _chunkSteps: r => {
                    y(() => {
                      Dt = false;
                      var z = r,
                        D = r;
                      nr || fr(oe._readableStreamController, z), ar || fr(de._readableStreamController, D), ye = false, Dt && _();
                    });
                  },
                  _closeSteps: () => {
                    ye = false, nr || dr(oe._readableStreamController), ar || dr(de._readableStreamController), nr && ar || me(undefined);
                  },
                  _errorSteps: () => {
                    ye = false;
                  }
                }), c(undefined));
              }
              function g() {}
              return oe = Cr(g, _, function p(z) {
                if (nr = true, te = z, ar) {
                  var _z13 = ne([te, re]),
                    _D10 = Br(r, _z13);
                  me(_D10);
                }
                return no;
              }), de = Cr(g, _, function S(z) {
                if (ar = true, re = z, nr) {
                  var _z14 = ne([te, re]),
                    _D11 = Br(r, _z14);
                  me(_D11);
                }
                return no;
              }), m(D._closedPromise, r => (br(oe._readableStreamController, r), br(de._readableStreamController, r), nr && ar || me(undefined), null)), [oe, de];
            }(r);
          }(this));
        }
      }, {
        key: "values",
        value: function values(r = undefined) {
          if (!Er(this)) throw kr("values");
          return function (r, z) {
            var D = H(r),
              te = new fo(D, z),
              re = Object.create(ho);
            return re._asyncIteratorImpl = te, re;
          }(this, function (r, z) {
            L(r, "First parameter");
            var D = null == r ? undefined : r.preventCancel;
            return {
              preventCancel: Boolean(D)
            };
          }(r).preventCancel);
        }
      }, {
        key: co,
        value: function (r) {
          return this.values(r);
        }
      }], [{
        key: "from",
        value: function from(r) {
          return Sr(r);
        }
      }]);
    }();
    function Cr(r, z, D, te = 1, re = () => 1) {
      var oe = Object.create(Co.prototype);
      return qr(oe), _r(oe, Object.create(To.prototype), r, z, D, te, re), oe;
    }
    function Pr(r, z, D) {
      var te = Object.create(Co.prototype);
      return qr(te), Je(te, Object.create(mo.prototype), r, z, D, 0, undefined), te;
    }
    function qr(r) {
      r._state = "readable", r._reader = undefined, r._storedError = undefined, r._disturbed = false;
    }
    function Er(r) {
      return !!t(r) && !!Object.prototype.hasOwnProperty.call(r, "_readableStreamController") && r instanceof Co;
    }
    function Wr(r) {
      return undefined !== r._reader;
    }
    function Br(r, z) {
      if (r._disturbed = true, "closed" === r._state) return c(undefined);
      if ("errored" === r._state) return d(r._storedError);
      Or(r);
      var D = r._reader;
      if (undefined !== D && at(D)) {
        var _r6 = D._readIntoRequests;
        D._readIntoRequests = new de(), _r6.forEach(r => {
          r._closeSteps(undefined);
        });
      }
      return _(r._readableStreamController[Dt](z), e);
    }
    function Or(r) {
      r._state = "closed";
      var z = r._reader;
      if (undefined !== z && (A(z), J(z))) {
        var _r7 = z._readRequests;
        z._readRequests = new de(), _r7.forEach(r => {
          r._closeSteps();
        });
      }
    }
    function jr(r, z) {
      r._state = "errored", r._storedError = z;
      var D = r._reader;
      undefined !== D && (k(D, z), J(D) ? Z(D, z) : lt(D, z));
    }
    function kr(r) {
      return new TypeError(`ReadableStream.prototype.${r} can only be used on a ReadableStream`);
    }
    function Ar(r, z) {
      L(r, z);
      var D = null == r ? undefined : r.highWaterMark;
      return M(D, "highWaterMark", "QueuingStrategyInit"), {
        highWaterMark: Y(D)
      };
    }
    Object.defineProperties(Co, {
      from: {
        enumerable: true
      }
    }), Object.defineProperties(Co.prototype, {
      cancel: {
        enumerable: true
      },
      getReader: {
        enumerable: true
      },
      pipeThrough: {
        enumerable: true
      },
      pipeTo: {
        enumerable: true
      },
      tee: {
        enumerable: true
      },
      values: {
        enumerable: true
      },
      locked: {
        enumerable: true
      }
    }), o(Co.from, "from"), o(Co.prototype.cancel, "cancel"), o(Co.prototype.getReader, "getReader"), o(Co.prototype.pipeThrough, "pipeThrough"), o(Co.prototype.pipeTo, "pipeTo"), o(Co.prototype.tee, "tee"), o(Co.prototype.values, "values"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(Co.prototype, Symbol.toStringTag, {
      value: "ReadableStream",
      configurable: true
    }), Object.defineProperty(Co.prototype, co, {
      value: Co.prototype.values,
      writable: true,
      configurable: true
    });
    var zr = r => r.byteLength;
    o(zr, "size");
    var Po = function () {
      return _createClass(function ByteLengthQueuingStrategy(r) {
        _classCallCheck(this, ByteLengthQueuingStrategy), $(r, 1, "ByteLengthQueuingStrategy"), r = Ar(r, "First parameter"), this._byteLengthQueuingStrategyHighWaterMark = r.highWaterMark;
      }, [{
        key: "highWaterMark",
        get: function () {
          if (!Lr(this)) throw Dr("highWaterMark");
          return this._byteLengthQueuingStrategyHighWaterMark;
        }
      }, {
        key: "size",
        get: function () {
          if (!Lr(this)) throw Dr("size");
          return zr;
        }
      }]);
    }();
    function Dr(r) {
      return new TypeError(`ByteLengthQueuingStrategy.prototype.${r} can only be used on a ByteLengthQueuingStrategy`);
    }
    function Lr(r) {
      return !!t(r) && !!Object.prototype.hasOwnProperty.call(r, "_byteLengthQueuingStrategyHighWaterMark") && r instanceof Po;
    }
    Object.defineProperties(Po.prototype, {
      highWaterMark: {
        enumerable: true
      },
      size: {
        enumerable: true
      }
    }), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(Po.prototype, Symbol.toStringTag, {
      value: "ByteLengthQueuingStrategy",
      configurable: true
    });
    var Fr = () => 1;
    o(Fr, "size");
    var ko = function () {
      return _createClass(function CountQueuingStrategy(r) {
        _classCallCheck(this, CountQueuingStrategy), $(r, 1, "CountQueuingStrategy"), r = Ar(r, "First parameter"), this._countQueuingStrategyHighWaterMark = r.highWaterMark;
      }, [{
        key: "highWaterMark",
        get: function () {
          if (!$r(this)) throw Ir("highWaterMark");
          return this._countQueuingStrategyHighWaterMark;
        }
      }, {
        key: "size",
        get: function () {
          if (!$r(this)) throw Ir("size");
          return Fr;
        }
      }]);
    }();
    function Ir(r) {
      return new TypeError(`CountQueuingStrategy.prototype.${r} can only be used on a CountQueuingStrategy`);
    }
    function $r(r) {
      return !!t(r) && !!Object.prototype.hasOwnProperty.call(r, "_countQueuingStrategyHighWaterMark") && r instanceof ko;
    }
    function Mr(r, z, D) {
      return F(r, D), D => g(r, z, [D]);
    }
    function Yr(r, z, D) {
      return F(r, D), D => S(r, z, [D]);
    }
    function Qr(r, z, D) {
      return F(r, D), (D, te) => g(r, z, [D, te]);
    }
    function xr(r, z, D) {
      return F(r, D), D => g(r, z, [D]);
    }
    Object.defineProperties(ko.prototype, {
      highWaterMark: {
        enumerable: true
      },
      size: {
        enumerable: true
      }
    }), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(ko.prototype, Symbol.toStringTag, {
      value: "CountQueuingStrategy",
      configurable: true
    });
    var qo = function () {
      return _createClass(function TransformStream(r = {}, z = {}, D = {}) {
        _classCallCheck(this, TransformStream), undefined === r && (r = null);
        var te = dt(z, "Second parameter"),
          re = dt(D, "Third parameter"),
          oe = function (r, z) {
            L(r, z);
            var D = null == r ? undefined : r.cancel,
              te = null == r ? undefined : r.flush,
              re = null == r ? undefined : r.readableType,
              oe = null == r ? undefined : r.start,
              de = null == r ? undefined : r.transform,
              me = null == r ? undefined : r.writableType;
            return {
              cancel: undefined === D ? undefined : xr(D, r, `${z} has member 'cancel' that`),
              flush: undefined === te ? undefined : Mr(te, r, `${z} has member 'flush' that`),
              readableType: re,
              start: undefined === oe ? undefined : Yr(oe, r, `${z} has member 'start' that`),
              transform: undefined === de ? undefined : Qr(de, r, `${z} has member 'transform' that`),
              writableType: me
            };
          }(r, "First parameter");
        if (undefined !== oe.readableType) throw new RangeError("Invalid readableType specified");
        if (undefined !== oe.writableType) throw new RangeError("Invalid writableType specified");
        var de = ut(re, 0),
          me = ct(re),
          ye = ut(te, 1),
          Dt = ct(te);
        var nr;
        !function (r, z, D, te, re, oe) {
          function i() {
            return z;
          }
          r._writable = function (r, z, D, te, re = 1, oe = () => 1) {
            var de = Object.create(yo.prototype);
            return St(de), Ft(de, Object.create(So.prototype), r, z, D, te, re, oe), de;
          }(i, function l(z) {
            return function (r, z) {
              var D = r._transformStreamController;
              return r._backpressure ? _(r._backpressureChangePromise, () => {
                var te = r._writable;
                if ("erroring" === te._state) throw te._storedError;
                return Zr(D, z);
              }) : Zr(D, z);
            }(r, z);
          }, function c() {
            return function (r) {
              var z = r._transformStreamController;
              if (undefined !== z._finishPromise) return z._finishPromise;
              var D = r._readable;
              z._finishPromise = u((r, D) => {
                z._finishPromise_resolve = r, z._finishPromise_reject = D;
              });
              var te = z._flushAlgorithm();
              return Jr(z), b(te, () => ("errored" === D._state ? ro(z, D._storedError) : (dr(D._readableStreamController), to(z)), null), r => (br(D._readableStreamController, r), ro(z, r), null)), z._finishPromise;
            }(r);
          }, function s(z) {
            return function (r, z) {
              var D = r._transformStreamController;
              if (undefined !== D._finishPromise) return D._finishPromise;
              var te = r._readable;
              D._finishPromise = u((r, z) => {
                D._finishPromise_resolve = r, D._finishPromise_reject = z;
              });
              var re = D._cancelAlgorithm(z);
              return Jr(D), b(re, () => ("errored" === te._state ? ro(D, te._storedError) : (br(te._readableStreamController, z), to(D)), null), r => (br(te._readableStreamController, r), ro(D, r), null)), D._finishPromise;
            }(r, z);
          }, D, te), r._readable = Cr(i, function d() {
            return function (r) {
              return Gr(r, false), r._backpressureChangePromise;
            }(r);
          }, function f(z) {
            return function (r, z) {
              var D = r._transformStreamController;
              if (undefined !== D._finishPromise) return D._finishPromise;
              var te = r._writable;
              D._finishPromise = u((r, z) => {
                D._finishPromise_resolve = r, D._finishPromise_reject = z;
              });
              var re = D._cancelAlgorithm(z);
              return Jr(D), b(re, () => ("errored" === te._state ? ro(D, te._storedError) : (Yt(te._writableStreamController, z), Ur(r), to(D)), null), z => (Yt(te._writableStreamController, z), Ur(r), ro(D, z), null)), D._finishPromise;
            }(r, z);
          }, re, oe), r._backpressure = undefined, r._backpressureChangePromise = undefined, r._backpressureChangePromise_resolve = undefined, Gr(r, true), r._transformStreamController = undefined;
        }(this, u(r => {
          nr = r;
        }), ye, Dt, de, me), function (r, z) {
          var D = Object.create(Eo.prototype);
          var te, re, oe;
          te = undefined !== z.transform ? r => z.transform(r, D) : r => {
            try {
              return Kr(D, r), c(undefined);
            } catch (r) {
              return d(r);
            }
          }, re = undefined !== z.flush ? () => z.flush(D) : () => c(undefined), oe = undefined !== z.cancel ? r => z.cancel(r) : () => c(undefined), function (r, z, D, te, re) {
            z._controlledTransformStream = r, r._transformStreamController = z, z._transformAlgorithm = D, z._flushAlgorithm = te, z._cancelAlgorithm = re, z._finishPromise = undefined, z._finishPromise_resolve = undefined, z._finishPromise_reject = undefined;
          }(r, D, te, re, oe);
        }(this, oe), undefined !== oe.start ? nr(oe.start(this._transformStreamController)) : nr(undefined);
      }, [{
        key: "readable",
        get: function () {
          if (!Nr(this)) throw oo("readable");
          return this._readable;
        }
      }, {
        key: "writable",
        get: function () {
          if (!Nr(this)) throw oo("writable");
          return this._writable;
        }
      }]);
    }();
    function Nr(r) {
      return !!t(r) && !!Object.prototype.hasOwnProperty.call(r, "_transformStreamController") && r instanceof qo;
    }
    function Hr(r, z) {
      br(r._readable._readableStreamController, z), Vr(r, z);
    }
    function Vr(r, z) {
      Jr(r._transformStreamController), Yt(r._writable._writableStreamController, z), Ur(r);
    }
    function Ur(r) {
      r._backpressure && Gr(r, false);
    }
    function Gr(r, z) {
      undefined !== r._backpressureChangePromise && r._backpressureChangePromise_resolve(), r._backpressureChangePromise = u(z => {
        r._backpressureChangePromise_resolve = z;
      }), r._backpressure = z;
    }
    Object.defineProperties(qo.prototype, {
      readable: {
        enumerable: true
      },
      writable: {
        enumerable: true
      }
    }), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(qo.prototype, Symbol.toStringTag, {
      value: "TransformStream",
      configurable: true
    });
    var Eo = function () {
      return _createClass(function TransformStreamDefaultController() {
        throw _classCallCheck(this, TransformStreamDefaultController), new TypeError("Illegal constructor");
      }, [{
        key: "desiredSize",
        get: function () {
          if (!Xr(this)) throw eo("desiredSize");
          return hr(this._controlledTransformStream._readable._readableStreamController);
        }
      }, {
        key: "enqueue",
        value: function enqueue(r = undefined) {
          if (!Xr(this)) throw eo("enqueue");
          Kr(this, r);
        }
      }, {
        key: "error",
        value: function error(r = undefined) {
          if (!Xr(this)) throw eo("error");
          var z;
          z = r, Hr(this._controlledTransformStream, z);
        }
      }, {
        key: "terminate",
        value: function terminate() {
          if (!Xr(this)) throw eo("terminate");
          !function (r) {
            var z = r._controlledTransformStream;
            dr(z._readable._readableStreamController);
            Vr(z, new TypeError("TransformStream terminated"));
          }(this);
        }
      }]);
    }();
    function Xr(r) {
      return !!t(r) && !!Object.prototype.hasOwnProperty.call(r, "_controlledTransformStream") && r instanceof Eo;
    }
    function Jr(r) {
      r._transformAlgorithm = undefined, r._flushAlgorithm = undefined, r._cancelAlgorithm = undefined;
    }
    function Kr(r, z) {
      var D = r._controlledTransformStream,
        te = D._readable._readableStreamController;
      if (!mr(te)) throw new TypeError("Readable side is not in a state that permits enqueue");
      try {
        fr(te, z);
      } catch (r) {
        throw Vr(D, r), D._readable._storedError;
      }
      var re = function (r) {
        return !ur(r);
      }(te);
      re !== D._backpressure && Gr(D, true);
    }
    function Zr(r, z) {
      return _(r._transformAlgorithm(z), undefined, z => {
        throw Hr(r._controlledTransformStream, z), z;
      });
    }
    function eo(r) {
      return new TypeError(`TransformStreamDefaultController.prototype.${r} can only be used on a TransformStreamDefaultController`);
    }
    function to(r) {
      undefined !== r._finishPromise_resolve && (r._finishPromise_resolve(), r._finishPromise_resolve = undefined, r._finishPromise_reject = undefined);
    }
    function ro(r, z) {
      undefined !== r._finishPromise_reject && (p(r._finishPromise), r._finishPromise_reject(z), r._finishPromise_resolve = undefined, r._finishPromise_reject = undefined);
    }
    function oo(r) {
      return new TypeError(`TransformStream.prototype.${r} can only be used on a TransformStream`);
    }
    Object.defineProperties(Eo.prototype, {
      enqueue: {
        enumerable: true
      },
      error: {
        enumerable: true
      },
      terminate: {
        enumerable: true
      },
      desiredSize: {
        enumerable: true
      }
    }), o(Eo.prototype.enqueue, "enqueue"), o(Eo.prototype.error, "error"), o(Eo.prototype.terminate, "terminate"), "symbol" == typeof Symbol.toStringTag && Object.defineProperty(Eo.prototype, Symbol.toStringTag, {
      value: "TransformStreamDefaultController",
      configurable: true
    });
    var Wo = {
      ReadableStream: Co,
      ReadableStreamDefaultController: To,
      ReadableByteStreamController: mo,
      ReadableStreamBYOBRequest: _o,
      ReadableStreamDefaultReader: ao,
      ReadableStreamBYOBReader: po,
      WritableStream: yo,
      WritableStreamDefaultController: So,
      WritableStreamDefaultWriter: vo,
      ByteLengthQueuingStrategy: Po,
      CountQueuingStrategy: ko,
      TransformStream: qo,
      TransformStreamDefaultController: Eo
    };
    for (var _r8 in Wo) Object.prototype.hasOwnProperty.call(Wo, _r8) && Object.defineProperty(wo, _r8, {
      value: Wo[_r8],
      writable: true,
      configurable: true
    });
  }();
})(typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  var _packagesSimCoreSrcIndex = require(_dependencyMap[0]);
  // Runs the Package A golden scenario inside the Hermes JavaScript engine (standalone CLI).
  // Bundled for Hermes by scripts/hermes-golden.mjs. `print` is Hermes' console output.

  var result = (0, _packagesSimCoreSrcIndex.runGoldenScenario)();
  var diffs = (0, _packagesSimCoreSrcIndex.diffGolden)(result, _packagesSimCoreSrcIndex.GOLDEN_EXPECTED);
  var properties = typeof HermesInternal !== 'undefined' && HermesInternal !== undefined && HermesInternal.getRuntimeProperties ? HermesInternal.getRuntimeProperties() : null;
  print(JSON.stringify({
    engine: properties === null ? 'unknown (no HermesInternal)' : 'hermes',
    runtime: properties,
    match: diffs.length === 0,
    diffs,
    fingerprint: result.fingerprint,
    eventChainHead: result.eventChainHead,
    finalSimDate: result.finalSimDate,
    revision: result.revision,
    eventCount: result.eventCount,
    rngDraws: result.rngDraws,
    commandDays: result.commandDays
  }));
},0,[1]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  var _ids = require(_dependencyMap[0]);
  Object.keys(_ids).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _ids[k];
        }
      });
    }
  });
  var _simDate = require(_dependencyMap[1]);
  Object.keys(_simDate).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _simDate[k];
        }
      });
    }
  });
  var _canonical = require(_dependencyMap[2]);
  Object.keys(_canonical).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _canonical[k];
        }
      });
    }
  });
  var _hash = require(_dependencyMap[3]);
  Object.keys(_hash).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _hash[k];
        }
      });
    }
  });
  var _provenance = require(_dependencyMap[4]);
  Object.keys(_provenance).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _provenance[k];
        }
      });
    }
  });
  var _ruleset = require(_dependencyMap[5]);
  Object.keys(_ruleset).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _ruleset[k];
        }
      });
    }
  });
  var _seed = require(_dependencyMap[6]);
  Object.keys(_seed).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _seed[k];
        }
      });
    }
  });
  var _rng = require(_dependencyMap[7]);
  Object.keys(_rng).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _rng[k];
        }
      });
    }
  });
  var _world = require(_dependencyMap[8]);
  Object.keys(_world).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _world[k];
        }
      });
    }
  });
  var _audit = require(_dependencyMap[9]);
  Object.keys(_audit).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _audit[k];
        }
      });
    }
  });
  var _kernel = require(_dependencyMap[10]);
  Object.keys(_kernel).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _kernel[k];
        }
      });
    }
  });
  var _persistence = require(_dependencyMap[11]);
  Object.keys(_persistence).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _persistence[k];
        }
      });
    }
  });
  var _memoryCareerStore = require(_dependencyMap[12]);
  Object.keys(_memoryCareerStore).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _memoryCareerStore[k];
        }
      });
    }
  });
  var _persistenceContract = require(_dependencyMap[13]);
  Object.keys(_persistenceContract).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _persistenceContract[k];
        }
      });
    }
  });
  var _recoveryContract = require(_dependencyMap[14]);
  Object.keys(_recoveryContract).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _recoveryContract[k];
        }
      });
    }
  });
  var _recovery = require(_dependencyMap[15]);
  Object.keys(_recovery).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _recovery[k];
        }
      });
    }
  });
  var _careerIntegrity = require(_dependencyMap[16]);
  Object.keys(_careerIntegrity).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _careerIntegrity[k];
        }
      });
    }
  });
  var _replay = require(_dependencyMap[17]);
  Object.keys(_replay).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _replay[k];
        }
      });
    }
  });
  var _syntheticFixtures = require(_dependencyMap[18]);
  Object.keys(_syntheticFixtures).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _syntheticFixtures[k];
        }
      });
    }
  });
  var _golden = require(_dependencyMap[19]);
  Object.keys(_golden).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _golden[k];
        }
      });
    }
  });
  var _goldenExpected = require(_dependencyMap[20]);
  Object.keys(_goldenExpected).forEach(function (k) {
    if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) {
      Object.defineProperty(exports, k, {
        enumerable: true,
        get: function () {
          return _goldenExpected[k];
        }
      });
    }
  });
},1,[2,3,4,5,10,11,12,13,14,15,16,17,18,19,20,22,21,23,24,25,26]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "ID_PATTERN", {
    enumerable: true,
    get: function () {
      return ID_PATTERN;
    }
  });
  Object.defineProperty(exports, "isValidId", {
    enumerable: true,
    get: function () {
      return isValidId;
    }
  });
  Object.defineProperty(exports, "worldId", {
    enumerable: true,
    get: function () {
      return worldId;
    }
  });
  Object.defineProperty(exports, "entityId", {
    enumerable: true,
    get: function () {
      return entityId;
    }
  });
  Object.defineProperty(exports, "commandId", {
    enumerable: true,
    get: function () {
      return commandId;
    }
  });
  Object.defineProperty(exports, "eventId", {
    enumerable: true,
    get: function () {
      return eventId;
    }
  });
  Object.defineProperty(exports, "isValidRevision", {
    enumerable: true,
    get: function () {
      return isValidRevision;
    }
  });
  Object.defineProperty(exports, "worldRevision", {
    enumerable: true,
    get: function () {
      return worldRevision;
    }
  });
  Object.defineProperty(exports, "ACTOR_KINDS", {
    enumerable: true,
    get: function () {
      return ACTOR_KINDS;
    }
  });
  Object.defineProperty(exports, "isActorRef", {
    enumerable: true,
    get: function () {
      return isActorRef;
    }
  });
  /**
   * Branded identifier and revision primitives.
   *
   * Brands exist only at the type level; at runtime an id is a plain string and a
   * revision a plain number, so they serialize canonically without wrappers.
   */

  /** 1-128 chars; starts alphanumeric; then alphanumerics and . _ : - */
  var ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  var isValidId = value => typeof value === 'string' && ID_PATTERN.test(value);
  var checkedId = (kind, value) => {
    if (!isValidId(value)) {
      throw new TypeError(`Invalid ${kind}: must match ${ID_PATTERN.source}`);
    }
    return value;
  };
  var worldId = value => checkedId('WorldId', value);
  var entityId = value => checkedId('EntityId', value);
  var commandId = value => checkedId('CommandId', value);
  var eventId = value => checkedId('EventId', value);
  var isValidRevision = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
  var worldRevision = value => {
    if (!isValidRevision(value)) {
      throw new TypeError('Invalid WorldRevision: must be a non-negative safe integer');
    }
    return value;
  };

  /** Who is submitting an intent. Authority is decided per command by the kernel. */
  var ACTOR_KINDS = ['human_gm', 'cpu_org', 'delegate', 'commissioner', 'system', 'test_harness'];
  var isActorRef = value => {
    if (typeof value !== 'object' || value === null) return false;
    var v = value;
    return typeof v.kind === 'string' && ACTOR_KINDS.includes(v.kind) && isValidId(v.id);
  };
},2,[]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "SimDate", {
    enumerable: true,
    get: function () {
      return SimDate;
    }
  });
  /**
   * Timezone-free calendar date value object.
   *
   * Simulation time never touches the device clock or `Date`. Dates are proleptic
   * Gregorian days; arithmetic uses integer civil-calendar algorithms
   * (H. Hinnant, "days_from_civil" / "civil_from_days") so every runtime agrees.
   */
  var ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var isLeap = y => y % 4 === 0 && y % 100 !== 0 || y % 400 === 0;
  var DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var daysInMonth = (y, m) => m === 2 && isLeap(y) ? 29 : DAYS_IN_MONTH[m - 1];
  var daysFromCivil = (yIn, m, d) => {
    var y = m <= 2 ? yIn - 1 : yIn;
    var era = Math.floor(y / 400);
    var yoe = y - era * 400;
    var doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  };
  var civilFromDays = zIn => {
    var z = zIn + 719468;
    var era = Math.floor(z / 146097);
    var doe = z - era * 146097;
    var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    var doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    var mp = Math.floor((5 * doy + 2) / 153);
    var d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    var m = mp < 10 ? mp + 3 : mp - 9;
    var y = yoe + era * 400 + (m <= 2 ? 1 : 0);
    return [y, m, d];
  };
  var pad = (n, width) => String(n).padStart(width, '0');
  class SimDate {
    /** Days since 1970-01-01 (proleptic Gregorian). */

    constructor(epochDay, year, month, day) {
      this.epochDay = epochDay;
      this.year = year;
      this.month = month;
      this.day = day;
      Object.freeze(this);
    }

    /** Parse strict `YYYY-MM-DD`. Anything else (times, zones, short forms) throws. */
    static parse(iso) {
      var match = typeof iso === 'string' ? ISO_DATE.exec(iso) : null;
      if (!match) throw new RangeError(`Invalid SimDate "${String(iso)}": expected YYYY-MM-DD`);
      var year = Number(match[1]);
      var month = Number(match[2]);
      var day = Number(match[3]);
      if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
        throw new RangeError(`Invalid SimDate "${iso}": not a real calendar date`);
      }
      return new SimDate(daysFromCivil(year, month, day), year, month, day);
    }
    static fromEpochDay(epochDay) {
      if (!Number.isSafeInteger(epochDay)) throw new RangeError('epochDay must be a safe integer');
      var [y, m, d] = civilFromDays(epochDay);
      if (y < 1 || y > 9999) throw new RangeError('SimDate out of supported range (years 1-9999)');
      return new SimDate(epochDay, y, m, d);
    }
    static isValidISO(iso) {
      try {
        SimDate.parse(iso);
        return true;
      } catch {
        return false;
      }
    }
    addDays(n) {
      if (!Number.isSafeInteger(n)) throw new RangeError('addDays requires a safe integer');
      return SimDate.fromEpochDay(this.epochDay + n);
    }
    daysSince(other) {
      return this.epochDay - other.epochDay;
    }
    compare(other) {
      return this.epochDay - other.epochDay;
    }
    equals(other) {
      return this.epochDay === other.epochDay;
    }
    toISO() {
      return `${pad(this.year, 4)}-${pad(this.month, 2)}-${pad(this.day, 2)}`;
    }
    toString() {
      return this.toISO();
    }
  }
},3,[]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "utf8Encode", {
    enumerable: true,
    get: function () {
      return utf8Encode;
    }
  });
  Object.defineProperty(exports, "canonicalString", {
    enumerable: true,
    get: function () {
      return canonicalString;
    }
  });
  Object.defineProperty(exports, "canonicalBytes", {
    enumerable: true,
    get: function () {
      return canonicalBytes;
    }
  });
  /**
   * Deterministic canonical serialization.
   *
   * `canonicalBytes(value)` yields identical bytes on every runtime (Node, Hermes)
   * for the same logical value, so hashes/fingerprints agree across platforms.
   *
   * Accepted: null, booleans, strings (no lone surrogates), safe integers (no -0),
   * dense arrays, plain objects (keys sorted by UTF-16 code unit).
   * Rejected with TypeError: undefined, non-integer/NaN/Infinity numbers, bigint,
   * functions, symbols, class instances (Date, Map, ...), sparse arrays, cycles.
   * Floats are rejected on purpose: authoritative math is integer-only.
   */
  var hasLoneSurrogate = s => {
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) {
        var n = s.charCodeAt(i + 1);
        if (n >= 0xdc00 && n <= 0xdfff) i++;else return true;
      } else if (c >= 0xdc00 && c <= 0xdfff) {
        return true;
      }
    }
    return false;
  };
  var serialize = (value, ancestors, path) => {
    if (value === null) return 'null';
    switch (typeof value) {
      case 'boolean':
        return value ? 'true' : 'false';
      case 'string':
        if (hasLoneSurrogate(value)) throw new TypeError(`Lone surrogate in string at ${path}`);
        return JSON.stringify(value);
      case 'number':
        if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
          throw new TypeError(`Non-canonical number at ${path}: only safe integers (no -0) allowed`);
        }
        return String(value);
      case 'object':
        break;
      default:
        throw new TypeError(`Unsupported type "${typeof value}" at ${path}`);
    }
    var obj = value;
    if (ancestors.includes(obj)) throw new TypeError(`Cycle detected at ${path}`);
    ancestors.push(obj);
    try {
      if (Array.isArray(obj)) {
        var _parts = [];
        for (var i = 0; i < obj.length; i++) {
          if (!(i in obj)) throw new TypeError(`Sparse array at ${path}[${i}]`);
          _parts.push(serialize(obj[i], ancestors, `${path}[${i}]`));
        }
        return `[${_parts.join(',')}]`;
      }
      var proto = Object.getPrototypeOf(obj);
      if (proto !== Object.prototype && proto !== null) {
        throw new TypeError(`Non-plain object at ${path}`);
      }
      var record = obj;
      var keys = Object.keys(record).sort();
      var parts = [];
      for (var key of keys) {
        if (hasLoneSurrogate(key)) throw new TypeError(`Lone surrogate in key at ${path}`);
        parts.push(`${JSON.stringify(key)}:${serialize(record[key], ancestors, `${path}.${key}`)}`);
      }
      return `{${parts.join(',')}}`;
    } finally {
      ancestors.pop();
    }
  };

  /** Manual UTF-8 encoder: no dependency on TextEncoder availability in any runtime. */
  var utf8Encode = text => {
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var cp = text.charCodeAt(i);
      if (cp >= 0xd800 && cp <= 0xdbff) {
        var lo = text.charCodeAt(i + 1);
        if (lo >= 0xdc00 && lo <= 0xdfff) {
          cp = 0x10000 + (cp - 0xd800 << 10) + (lo - 0xdc00);
          i++;
        } else {
          throw new TypeError('Lone surrogate cannot be UTF-8 encoded');
        }
      }
      if (cp < 0x80) {
        out.push(cp);
      } else if (cp < 0x800) {
        out.push(0xc0 | cp >> 6, 0x80 | cp & 0x3f);
      } else if (cp < 0x10000) {
        out.push(0xe0 | cp >> 12, 0x80 | cp >> 6 & 0x3f, 0x80 | cp & 0x3f);
      } else {
        out.push(0xf0 | cp >> 18, 0x80 | cp >> 12 & 0x3f, 0x80 | cp >> 6 & 0x3f, 0x80 | cp & 0x3f);
      }
    }
    return Uint8Array.from(out);
  };
  var canonicalString = value => serialize(value, [], '$');
  var canonicalBytes = value => utf8Encode(canonicalString(value));
},4,[]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "HASH_PATTERN", {
    enumerable: true,
    get: function () {
      return HASH_PATTERN;
    }
  });
  Object.defineProperty(exports, "isHash", {
    enumerable: true,
    get: function () {
      return isHash;
    }
  });
  Object.defineProperty(exports, "Hash32", {
    enumerable: true,
    get: function () {
      return Hash32;
    }
  });
  Object.defineProperty(exports, "hashCanonical", {
    enumerable: true,
    get: function () {
      return hashCanonical;
    }
  });
  var _nobleHashesSha2Js = require(_dependencyMap[0]);
  var _nobleHashesUtilsJs = require(_dependencyMap[1]);
  var _canonical = require(_dependencyMap[2]);
  /** Matches exactly 64 lowercase hex characters. */
  var HASH_PATTERN = /^[0-9a-f]{64}$/;
  var isHash = value => typeof value === 'string' && HASH_PATTERN.test(value);
  var Hash32 = {
    /** SHA-256 over raw bytes, returned as 64 lowercase hex characters. */
    sha256(bytes) {
      return (0, _nobleHashesUtilsJs.bytesToHex)((0, _nobleHashesSha2Js.sha256)(bytes));
    }
  };

  /** SHA-256 over the canonical bytes of a value. */
  var hashCanonical = value => Hash32.sha256((0, _canonical.canonicalBytes)(value));
},5,[6,9,4]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = {};
    if (e) Object.keys(e).forEach(function (k) {
      var d = Object.getOwnPropertyDescriptor(e, k);
      Object.defineProperty(n, k, d.get ? d : {
        enumerable: true,
        get: function () {
          return e[k];
        }
      });
    });
    n.default = e;
    return n;
  }
  Object.defineProperty(exports, "_SHA256", {
    enumerable: true,
    get: function () {
      return _SHA256;
    }
  });
  Object.defineProperty(exports, "_SHA224", {
    enumerable: true,
    get: function () {
      return _SHA224;
    }
  });
  Object.defineProperty(exports, "_SHA512", {
    enumerable: true,
    get: function () {
      return _SHA512;
    }
  });
  Object.defineProperty(exports, "_SHA384", {
    enumerable: true,
    get: function () {
      return _SHA384;
    }
  });
  Object.defineProperty(exports, "_SHA512_224", {
    enumerable: true,
    get: function () {
      return _SHA512_224;
    }
  });
  Object.defineProperty(exports, "_SHA512_256", {
    enumerable: true,
    get: function () {
      return _SHA512_256;
    }
  });
  Object.defineProperty(exports, "sha256", {
    enumerable: true,
    get: function () {
      return sha256;
    }
  });
  Object.defineProperty(exports, "sha224", {
    enumerable: true,
    get: function () {
      return sha224;
    }
  });
  Object.defineProperty(exports, "sha512", {
    enumerable: true,
    get: function () {
      return sha512;
    }
  });
  Object.defineProperty(exports, "sha384", {
    enumerable: true,
    get: function () {
      return sha384;
    }
  });
  Object.defineProperty(exports, "sha512_256", {
    enumerable: true,
    get: function () {
      return sha512_256;
    }
  });
  Object.defineProperty(exports, "sha512_224", {
    enumerable: true,
    get: function () {
      return sha512_224;
    }
  });
  var _mdJs = require(_dependencyMap[0]);
  var _u64Js = require(_dependencyMap[1]);
  var u64 = _interopNamespace(_u64Js);
  var _utilsJs = require(_dependencyMap[2]);
  /**
   * SHA2 hash function. A.k.a. sha256, sha384, sha512, sha512_224, sha512_256.
   * SHA256 is the fastest hash implementable in JS, even faster than Blake3.
   * Check out {@link https://www.rfc-editor.org/rfc/rfc4634 | RFC 4634} and
   * {@link https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf | FIPS 180-4}.
   * @module
   */

  /**
   * SHA-224 / SHA-256 round constants from RFC 6234 §5.1: the first 32 bits
   * of the cube roots of the first 64 primes (2..311).
   */
  // prettier-ignore
  var SHA256_K = /* @__PURE__ */Uint32Array.from([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  /** Reusable SHA-224 / SHA-256 message schedule buffer `W_t` from RFC 6234 §6.2 step 1. */
  var SHA256_W = /* @__PURE__ */new Uint32Array(64);
  /** Internal SHA-224 / SHA-256 compression engine from RFC 6234 §6.2. */
  class SHA2_32B extends _mdJs.HashMD {
    // We cannot use array here since array allows indexing by variable
    // which means optimizer/compiler cannot use registers.
    // Numeric initializers matter: starting the fields as `undefined` changes
    // V8's field representation and makes sha256 3x slower (measured).
    A = 0;
    B = 0;
    C = 0;
    D = 0;
    E = 0;
    F = 0;
    G = 0;
    H = 0;
    constructor(outputLen, IV) {
      super(64, outputLen, 8, false);
      this.A = IV[0] | 0;
      this.B = IV[1] | 0;
      this.C = IV[2] | 0;
      this.D = IV[3] | 0;
      this.E = IV[4] | 0;
      this.F = IV[5] | 0;
      this.G = IV[6] | 0;
      this.H = IV[7] | 0;
    }
    get() {
      var {
        A,
        B,
        C,
        D,
        E,
        F,
        G,
        H
      } = this;
      return [A, B, C, D, E, F, G, H];
    }
    // prettier-ignore
    set(A, B, C, D, E, F, G, H) {
      this.A = A | 0;
      this.B = B | 0;
      this.C = C | 0;
      this.D = D | 0;
      this.E = E | 0;
      this.F = F | 0;
      this.G = G | 0;
      this.H = H | 0;
    }
    _cloneInto(to) {
      (to ||= new this.constructor()).set(...this.get());
      return this._cloneIntoMeta(to);
    }
    process(view, offset) {
      // Extend the first 16 words into the remaining 48 words w[16..63] of the message schedule array
      for (var i = 0; i < 16; i++, offset += 4) SHA256_W[i] = view.getUint32(offset, false);
      for (var _i = 16; _i < 64; _i++) {
        var W15 = SHA256_W[_i - 15];
        var W2 = SHA256_W[_i - 2];
        var s0 = (0, _utilsJs.rotr)(W15, 7) ^ (0, _utilsJs.rotr)(W15, 18) ^ W15 >>> 3;
        var s1 = (0, _utilsJs.rotr)(W2, 17) ^ (0, _utilsJs.rotr)(W2, 19) ^ W2 >>> 10;
        SHA256_W[_i] = s1 + SHA256_W[_i - 7] + s0 + SHA256_W[_i - 16] | 0;
      }
      // Compression function main loop, 64 rounds
      var {
        A,
        B,
        C,
        D,
        E,
        F,
        G,
        H
      } = this;
      for (var _i2 = 0; _i2 < 64; _i2++) {
        var sigma1 = (0, _utilsJs.rotr)(E, 6) ^ (0, _utilsJs.rotr)(E, 11) ^ (0, _utilsJs.rotr)(E, 25);
        var T1 = H + sigma1 + (0, _mdJs.Chi)(E, F, G) + SHA256_K[_i2] + SHA256_W[_i2] | 0;
        var sigma0 = (0, _utilsJs.rotr)(A, 2) ^ (0, _utilsJs.rotr)(A, 13) ^ (0, _utilsJs.rotr)(A, 22);
        var T2 = sigma0 + (0, _mdJs.Maj)(A, B, C) | 0;
        H = G;
        G = F;
        F = E;
        E = D + T1 | 0;
        D = C;
        C = B;
        B = A;
        A = T1 + T2 | 0;
      }
      // Add the compressed chunk to the current hash value
      A = A + this.A | 0;
      B = B + this.B | 0;
      C = C + this.C | 0;
      D = D + this.D | 0;
      E = E + this.E | 0;
      F = F + this.F | 0;
      G = G + this.G | 0;
      H = H + this.H | 0;
      this.set(A, B, C, D, E, F, G, H);
    }
    roundClean() {
      (0, _utilsJs.clean)(SHA256_W);
    }
    destroy() {
      // HashMD callers route post-destroy usability through `destroyed`; zeroizing alone still leaves
      // update()/digest() callable on reused instances.
      this.destroyed = true;
      this.set(0, 0, 0, 0, 0, 0, 0, 0);
      (0, _utilsJs.clean)(this.buffer);
    }
  }
  /** Internal SHA-256 hash class grounded in RFC 6234 §6.2. */
  class _SHA256 extends SHA2_32B {
    constructor() {
      super(32, _mdJs.SHA256_IV);
    }
  }
  /** Internal SHA-224 hash class grounded in RFC 6234 §6.2 and §8.5. */
  class _SHA224 extends SHA2_32B {
    constructor() {
      super(28, _mdJs.SHA224_IV);
    }
  }
  // SHA2-512 is slower than sha256 in js because u64 operations are slow.
  // SHA-384 / SHA-512 round constants from RFC 6234 §5.2:
  // 80 full 64-bit words split into high/low halves.
  // prettier-ignore
  var K512 = /* @__PURE__ */(() => u64.split(['0x428a2f98d728ae22', '0x7137449123ef65cd', '0xb5c0fbcfec4d3b2f', '0xe9b5dba58189dbbc', '0x3956c25bf348b538', '0x59f111f1b605d019', '0x923f82a4af194f9b', '0xab1c5ed5da6d8118', '0xd807aa98a3030242', '0x12835b0145706fbe', '0x243185be4ee4b28c', '0x550c7dc3d5ffb4e2', '0x72be5d74f27b896f', '0x80deb1fe3b1696b1', '0x9bdc06a725c71235', '0xc19bf174cf692694', '0xe49b69c19ef14ad2', '0xefbe4786384f25e3', '0x0fc19dc68b8cd5b5', '0x240ca1cc77ac9c65', '0x2de92c6f592b0275', '0x4a7484aa6ea6e483', '0x5cb0a9dcbd41fbd4', '0x76f988da831153b5', '0x983e5152ee66dfab', '0xa831c66d2db43210', '0xb00327c898fb213f', '0xbf597fc7beef0ee4', '0xc6e00bf33da88fc2', '0xd5a79147930aa725', '0x06ca6351e003826f', '0x142929670a0e6e70', '0x27b70a8546d22ffc', '0x2e1b21385c26c926', '0x4d2c6dfc5ac42aed', '0x53380d139d95b3df', '0x650a73548baf63de', '0x766a0abb3c77b2a8', '0x81c2c92e47edaee6', '0x92722c851482353b', '0xa2bfe8a14cf10364', '0xa81a664bbc423001', '0xc24b8b70d0f89791', '0xc76c51a30654be30', '0xd192e819d6ef5218', '0xd69906245565a910', '0xf40e35855771202a', '0x106aa07032bbd1b8', '0x19a4c116b8d2d0c8', '0x1e376c085141ab53', '0x2748774cdf8eeb99', '0x34b0bcb5e19b48a8', '0x391c0cb3c5c95a63', '0x4ed8aa4ae3418acb', '0x5b9cca4f7763e373', '0x682e6ff3d6b2b8a3', '0x748f82ee5defb2fc', '0x78a5636f43172f60', '0x84c87814a1f0ab72', '0x8cc702081a6439ec', '0x90befffa23631e28', '0xa4506cebde82bde9', '0xbef9a3f7b2c67915', '0xc67178f2e372532b', '0xca273eceea26619c', '0xd186b8c721c0c207', '0xeada7dd6cde0eb1e', '0xf57d4f7fee6ed178', '0x06f067aa72176fba', '0x0a637dc5a2c898a6', '0x113f9804bef90dae', '0x1b710b35131c471b', '0x28db77f523047d84', '0x32caab7b40c72493', '0x3c9ebe0a15c9bebc', '0x431d67c49c100d4c', '0x4cc5d4becb3e42b6', '0x597f299cfc657e2a', '0x5fcb6fab3ad6faec', '0x6c44198c4a475817'].map(n => BigInt(n))))();
  var SHA512_Kh = /* @__PURE__ */(() => K512[0])();
  var SHA512_Kl = /* @__PURE__ */(() => K512[1])();
  // Reusable high-half schedule buffer for the RFC 6234 §6.4 64-bit `W_t` words.
  var SHA512_W_H = /* @__PURE__ */new Uint32Array(80);
  // Reusable low-half schedule buffer for the RFC 6234 §6.4 64-bit `W_t` words.
  var SHA512_W_L = /* @__PURE__ */new Uint32Array(80);
  /** Internal SHA-384 / SHA-512 compression engine from RFC 6234 §6.4. */
  class SHA2_64B extends _mdJs.HashMD {
    // We cannot use array here since array allows indexing by variable
    // which means optimizer/compiler cannot use registers.
    // h -- high 32 bits, l -- low 32 bits
    // Numeric initializers matter: starting the fields as `undefined` changes
    // V8's field representation and slows hashing down (measured on sha256).
    Ah = 0;
    Al = 0;
    Bh = 0;
    Bl = 0;
    Ch = 0;
    Cl = 0;
    Dh = 0;
    Dl = 0;
    Eh = 0;
    El = 0;
    Fh = 0;
    Fl = 0;
    Gh = 0;
    Gl = 0;
    Hh = 0;
    Hl = 0;
    constructor(outputLen, IV) {
      super(128, outputLen, 16, false);
      this.Ah = IV[0] | 0;
      this.Al = IV[1] | 0;
      this.Bh = IV[2] | 0;
      this.Bl = IV[3] | 0;
      this.Ch = IV[4] | 0;
      this.Cl = IV[5] | 0;
      this.Dh = IV[6] | 0;
      this.Dl = IV[7] | 0;
      this.Eh = IV[8] | 0;
      this.El = IV[9] | 0;
      this.Fh = IV[10] | 0;
      this.Fl = IV[11] | 0;
      this.Gh = IV[12] | 0;
      this.Gl = IV[13] | 0;
      this.Hh = IV[14] | 0;
      this.Hl = IV[15] | 0;
    }
    // prettier-ignore
    get() {
      var {
        Ah,
        Al,
        Bh,
        Bl,
        Ch,
        Cl,
        Dh,
        Dl,
        Eh,
        El,
        Fh,
        Fl,
        Gh,
        Gl,
        Hh,
        Hl
      } = this;
      return [Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl];
    }
    // prettier-ignore
    set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl) {
      this.Ah = Ah | 0;
      this.Al = Al | 0;
      this.Bh = Bh | 0;
      this.Bl = Bl | 0;
      this.Ch = Ch | 0;
      this.Cl = Cl | 0;
      this.Dh = Dh | 0;
      this.Dl = Dl | 0;
      this.Eh = Eh | 0;
      this.El = El | 0;
      this.Fh = Fh | 0;
      this.Fl = Fl | 0;
      this.Gh = Gh | 0;
      this.Gl = Gl | 0;
      this.Hh = Hh | 0;
      this.Hl = Hl | 0;
    }
    _cloneInto(to) {
      (to ||= new this.constructor()).set(...this.get());
      return this._cloneIntoMeta(to);
    }
    process(view, offset) {
      // Extend the first 16 words into the remaining 64 words w[16..79] of the message schedule array
      for (var i = 0; i < 16; i++, offset += 4) {
        SHA512_W_H[i] = view.getUint32(offset);
        SHA512_W_L[i] = view.getUint32(offset += 4);
      }
      for (var _i3 = 16; _i3 < 80; _i3++) {
        // s0 := (w[i-15] rightrotate 1) xor (w[i-15] rightrotate 8) xor (w[i-15] rightshift 7)
        var W15h = SHA512_W_H[_i3 - 15] | 0;
        var W15l = SHA512_W_L[_i3 - 15] | 0;
        var s0h = u64.rotrSH(W15h, W15l, 1) ^ u64.rotrSH(W15h, W15l, 8) ^ u64.shrSH(W15h, W15l, 7);
        var s0l = u64.rotrSL(W15h, W15l, 1) ^ u64.rotrSL(W15h, W15l, 8) ^ u64.shrSL(W15h, W15l, 7);
        // s1 := (w[i-2] rightrotate 19) xor (w[i-2] rightrotate 61) xor (w[i-2] rightshift 6)
        var W2h = SHA512_W_H[_i3 - 2] | 0;
        var W2l = SHA512_W_L[_i3 - 2] | 0;
        var s1h = u64.rotrSH(W2h, W2l, 19) ^ u64.rotrBH(W2h, W2l, 61) ^ u64.shrSH(W2h, W2l, 6);
        var s1l = u64.rotrSL(W2h, W2l, 19) ^ u64.rotrBL(W2h, W2l, 61) ^ u64.shrSL(W2h, W2l, 6);
        // SHA512_W[i] = s0 + s1 + SHA512_W[i - 7] + SHA512_W[i - 16];
        var SUMl = u64.add4L(s0l, s1l, SHA512_W_L[_i3 - 7], SHA512_W_L[_i3 - 16]);
        var SUMh = u64.add4H(SUMl, s0h, s1h, SHA512_W_H[_i3 - 7], SHA512_W_H[_i3 - 16]);
        SHA512_W_H[_i3] = SUMh | 0;
        SHA512_W_L[_i3] = SUMl | 0;
      }
      var {
        Ah,
        Al,
        Bh,
        Bl,
        Ch,
        Cl,
        Dh,
        Dl,
        Eh,
        El,
        Fh,
        Fl,
        Gh,
        Gl,
        Hh,
        Hl
      } = this;
      // Compression function main loop, 80 rounds
      for (var _i4 = 0; _i4 < 80; _i4++) {
        // S1 := (e rightrotate 14) xor (e rightrotate 18) xor (e rightrotate 41)
        var sigma1h = u64.rotrSH(Eh, El, 14) ^ u64.rotrSH(Eh, El, 18) ^ u64.rotrBH(Eh, El, 41);
        var sigma1l = u64.rotrSL(Eh, El, 14) ^ u64.rotrSL(Eh, El, 18) ^ u64.rotrBL(Eh, El, 41);
        //const T1 = (H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i]) | 0;
        var CHIh = Eh & Fh ^ ~Eh & Gh;
        var CHIl = El & Fl ^ ~El & Gl;
        // T1 = H + sigma1 + Chi(E, F, G) + SHA512_K[i] + SHA512_W[i]
        // prettier-ignore
        var T1ll = u64.add5L(Hl, sigma1l, CHIl, SHA512_Kl[_i4], SHA512_W_L[_i4]);
        var T1h = u64.add5H(T1ll, Hh, sigma1h, CHIh, SHA512_Kh[_i4], SHA512_W_H[_i4]);
        var T1l = T1ll | 0;
        // S0 := (a rightrotate 28) xor (a rightrotate 34) xor (a rightrotate 39)
        var sigma0h = u64.rotrSH(Ah, Al, 28) ^ u64.rotrBH(Ah, Al, 34) ^ u64.rotrBH(Ah, Al, 39);
        var sigma0l = u64.rotrSL(Ah, Al, 28) ^ u64.rotrBL(Ah, Al, 34) ^ u64.rotrBL(Ah, Al, 39);
        var MAJh = Ah & Bh ^ Ah & Ch ^ Bh & Ch;
        var MAJl = Al & Bl ^ Al & Cl ^ Bl & Cl;
        Hh = Gh | 0;
        Hl = Gl | 0;
        Gh = Fh | 0;
        Gl = Fl | 0;
        Fh = Eh | 0;
        Fl = El | 0;
        ({
          h: Eh,
          l: El
        } = u64.add(Dh | 0, Dl | 0, T1h | 0, T1l | 0));
        Dh = Ch | 0;
        Dl = Cl | 0;
        Ch = Bh | 0;
        Cl = Bl | 0;
        Bh = Ah | 0;
        Bl = Al | 0;
        var All = u64.add3L(T1l, sigma0l, MAJl);
        Ah = u64.add3H(All, T1h, sigma0h, MAJh);
        Al = All | 0;
      }
      // Add the compressed chunk to the current hash value
      ({
        h: Ah,
        l: Al
      } = u64.add(this.Ah | 0, this.Al | 0, Ah | 0, Al | 0));
      ({
        h: Bh,
        l: Bl
      } = u64.add(this.Bh | 0, this.Bl | 0, Bh | 0, Bl | 0));
      ({
        h: Ch,
        l: Cl
      } = u64.add(this.Ch | 0, this.Cl | 0, Ch | 0, Cl | 0));
      ({
        h: Dh,
        l: Dl
      } = u64.add(this.Dh | 0, this.Dl | 0, Dh | 0, Dl | 0));
      ({
        h: Eh,
        l: El
      } = u64.add(this.Eh | 0, this.El | 0, Eh | 0, El | 0));
      ({
        h: Fh,
        l: Fl
      } = u64.add(this.Fh | 0, this.Fl | 0, Fh | 0, Fl | 0));
      ({
        h: Gh,
        l: Gl
      } = u64.add(this.Gh | 0, this.Gl | 0, Gh | 0, Gl | 0));
      ({
        h: Hh,
        l: Hl
      } = u64.add(this.Hh | 0, this.Hl | 0, Hh | 0, Hl | 0));
      this.set(Ah, Al, Bh, Bl, Ch, Cl, Dh, Dl, Eh, El, Fh, Fl, Gh, Gl, Hh, Hl);
    }
    roundClean() {
      (0, _utilsJs.clean)(SHA512_W_H, SHA512_W_L);
    }
    destroy() {
      // HashMD callers route post-destroy usability through `destroyed`; zeroizing alone still leaves
      // update()/digest() callable on reused instances.
      this.destroyed = true;
      (0, _utilsJs.clean)(this.buffer);
      this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
  }
  /** Internal SHA-512 hash class grounded in RFC 6234 §6.3 and §6.4. */
  class _SHA512 extends SHA2_64B {
    constructor() {
      super(64, _mdJs.SHA512_IV);
    }
  }
  /** Internal SHA-384 hash class grounded in RFC 6234 §6.3 and §6.4. */
  class _SHA384 extends SHA2_64B {
    constructor() {
      super(48, _mdJs.SHA384_IV);
    }
  }
  /**
   * Truncated SHA512/256 and SHA512/224.
   * SHA512_IV is XORed with 0xa5a5a5a5a5a5a5a5, then used as "intermediary" IV of SHA512/t.
   * Then t hashes string to produce result IV.
   * See the repo-side derivation recipe in `test/misc/sha2-gen-iv.js`.
   * These IV literals are checked against that script rather than a dedicated
   * local RFC section.
   */
  /** SHA-512/224 IV derived by the SHA-512/t recipe in `test/misc/sha2-gen-iv.js` and
   * stored as sixteen big-endian 32-bit halves. */
  var T224_IV = /* @__PURE__ */Uint32Array.from([0x8c3d37c8, 0x19544da2, 0x73e19966, 0x89dcd4d6, 0x1dfab7ae, 0x32ff9c82, 0x679dd514, 0x582f9fcf, 0x0f6d2b69, 0x7bd44da8, 0x77e36f73, 0x04c48942, 0x3f9d85a8, 0x6a1d36c8, 0x1112e6ad, 0x91d692a1]);
  /** SHA-512/256 IV derived by the SHA-512/t recipe in `test/misc/sha2-gen-iv.js` and
   * stored as sixteen big-endian 32-bit halves. */
  var T256_IV = /* @__PURE__ */Uint32Array.from([0x22312194, 0xfc2bf72c, 0x9f555fa3, 0xc84c64c2, 0x2393b86b, 0x6f53b151, 0x96387719, 0x5940eabd, 0x96283ee2, 0xa88effe3, 0xbe5e1e25, 0x53863992, 0x2b0199fc, 0x2c85b8aa, 0x0eb72ddc, 0x81c52ca2]);
  /** Internal SHA-512/224 hash class using the derived `T224_IV` and the shared
   * RFC 6234 §6.4 compression engine. */
  class _SHA512_224 extends SHA2_64B {
    constructor() {
      super(28, T224_IV);
    }
  }
  /** Internal SHA-512/256 hash class using the derived `T256_IV` and the shared
   * RFC 6234 §6.4 compression engine. */
  class _SHA512_256 extends SHA2_64B {
    constructor() {
      super(32, T256_IV);
    }
  }
  /**
   * SHA2-256 hash function from RFC 4634. In JS it's the fastest: even faster than Blake3. Some info:
   *
   * - Trying 2^128 hashes would get 50% chance of collision, using birthday attack.
   * - BTC network is doing 2^70 hashes/sec (2^95 hashes/year) as per 2025.
   * - Each sha256 hash is executing 2^18 bit operations.
   * - Good 2024 ASICs can do 200Th/sec with 3500 watts of power, corresponding to 2^36 hashes/joule.
   * @param msg - message bytes to hash
   * @param opts - Reserved hash options.
   * @returns Digest bytes.
   * @example
   * Hash a message with SHA2-256.
   * ```ts
   * sha256(new Uint8Array([97, 98, 99]));
   * ```
   */
  var sha256 = /* @__PURE__ */(0, _utilsJs.createHasher)(() => new _SHA256(), /* @__PURE__ */(0, _utilsJs.oidNist)(0x01));
  /**
   * SHA2-224 hash function from RFC 4634.
   * @param msg - message bytes to hash
   * @param opts - Reserved hash options.
   * @returns Digest bytes.
   * @example
   * Hash a message with SHA2-224.
   * ```ts
   * sha224(new Uint8Array([97, 98, 99]));
   * ```
   */
  var sha224 = /* @__PURE__ */(0, _utilsJs.createHasher)(() => new _SHA224(), /* @__PURE__ */(0, _utilsJs.oidNist)(0x04));
  /**
   * SHA2-512 hash function from RFC 4634.
   * @param msg - message bytes to hash
   * @param opts - Reserved hash options.
   * @returns Digest bytes.
   * @example
   * Hash a message with SHA2-512.
   * ```ts
   * sha512(new Uint8Array([97, 98, 99]));
   * ```
   */
  var sha512 = /* @__PURE__ */(0, _utilsJs.createHasher)(() => new _SHA512(), /* @__PURE__ */(0, _utilsJs.oidNist)(0x03));
  /**
   * SHA2-384 hash function from RFC 4634.
   * @param msg - message bytes to hash
   * @param opts - Reserved hash options.
   * @returns Digest bytes.
   * @example
   * Hash a message with SHA2-384.
   * ```ts
   * sha384(new Uint8Array([97, 98, 99]));
   * ```
   */
  var sha384 = /* @__PURE__ */(0, _utilsJs.createHasher)(() => new _SHA384(), /* @__PURE__ */(0, _utilsJs.oidNist)(0x02));
  /**
   * SHA2-512/256 "truncated" hash function, with improved resistance to length extension attacks.
   * See the paper on {@link https://eprint.iacr.org/2010/548.pdf | truncated SHA512}.
   * @param msg - message bytes to hash
   * @param opts - Reserved hash options.
   * @returns Digest bytes.
   * @example
   * Hash a message with SHA2-512/256.
   * ```ts
   * sha512_256(new Uint8Array([97, 98, 99]));
   * ```
   */
  var sha512_256 = /* @__PURE__ */(0, _utilsJs.createHasher)(() => new _SHA512_256(), /* @__PURE__ */(0, _utilsJs.oidNist)(0x06));
  /**
   * SHA2-512/224 "truncated" hash function, with improved resistance to length extension attacks.
   * See the paper on {@link https://eprint.iacr.org/2010/548.pdf | truncated SHA512}.
   * @param msg - message bytes to hash
   * @param opts - Reserved hash options.
   * @returns Digest bytes.
   * @example
   * Hash a message with SHA2-512/224.
   * ```ts
   * sha512_224(new Uint8Array([97, 98, 99]));
   * ```
   */
  var sha512_224 = /* @__PURE__ */(0, _utilsJs.createHasher)(() => new _SHA512_224(), /* @__PURE__ */(0, _utilsJs.oidNist)(0x05));
},6,[7,8,9]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  exports.Chi = Chi;
  exports.Maj = Maj;
  Object.defineProperty(exports, "HashMD", {
    enumerable: true,
    get: function () {
      return HashMD;
    }
  });
  Object.defineProperty(exports, "SHA256_IV", {
    enumerable: true,
    get: function () {
      return SHA256_IV;
    }
  });
  Object.defineProperty(exports, "SHA224_IV", {
    enumerable: true,
    get: function () {
      return SHA224_IV;
    }
  });
  Object.defineProperty(exports, "SHA384_IV", {
    enumerable: true,
    get: function () {
      return SHA384_IV;
    }
  });
  Object.defineProperty(exports, "SHA512_IV", {
    enumerable: true,
    get: function () {
      return SHA512_IV;
    }
  });
  var _u64Js = require(_dependencyMap[0]);
  var _utilsJs = require(_dependencyMap[1]);
  /**
   * Internal Merkle-Damgard hash utils.
   * @module
   */

  /**
   * Shared 32-bit conditional boolean primitive reused by SHA-256, SHA-1, and MD5 `F`.
   * Returns bits from `b` when `a` is set, otherwise from `c`.
   * The XOR form is equivalent to MD5's `F(X,Y,Z) = XY v not(X)Z` because the masked terms never
   * set the same bit.
   * @param a - selector word
   * @param b - word chosen when selector bit is set
   * @param c - word chosen when selector bit is clear
   * @returns Mixed 32-bit word.
   * @example
   * Combine three words with the shared 32-bit choice primitive.
   * ```ts
   * Chi(0xffffffff, 0x12345678, 0x87654321);
   * ```
   */
  function Chi(a, b, c) {
    return a & b ^ ~a & c;
  }
  /**
   * Shared 32-bit majority primitive reused by SHA-256 and SHA-1.
   * Returns bits shared by at least two inputs.
   * @param a - first input word
   * @param b - second input word
   * @param c - third input word
   * @returns Mixed 32-bit word.
   * @example
   * Combine three words with the shared 32-bit majority primitive.
   * ```ts
   * Maj(0xffffffff, 0x12345678, 0x87654321);
   * ```
   */
  function Maj(a, b, c) {
    return a & b ^ a & c ^ b & c;
  }
  /**
   * Merkle-Damgard hash construction base class.
   * Could be used to create MD5, RIPEMD, SHA1, SHA2.
   * Accepts only byte-aligned `Uint8Array` input, even when the underlying spec describes bit
   * strings with partial-byte tails.
   * @param blockLen - internal block size in bytes
   * @param outputLen - digest size in bytes
   * @param padOffset - trailing length field size in bytes
   * @param isLE - whether length and state words are encoded in little-endian
   * @example
   * Use a concrete subclass to get the shared Merkle-Damgard update/digest flow.
   * ```ts
   * import { _SHA1 } from '@noble/hashes/legacy.js';
   * const hash = new _SHA1();
   * hash.update(new Uint8Array([97, 98, 99]));
   * hash.digest();
   * ```
   */
  class HashMD {
    canXOF = false;

    // For partial updates less than block size

    finished = false;
    length = 0;
    pos = 0;
    destroyed = false;
    constructor(blockLen, outputLen, padOffset, isLE) {
      this.blockLen = blockLen;
      this.outputLen = outputLen;
      this.padOffset = padOffset;
      this.isLE = isLE;
      this.buffer = new Uint8Array(blockLen);
      this.view = (0, _utilsJs.createView)(this.buffer);
    }
    update(data) {
      (0, _utilsJs.aexists)(this);
      (0, _utilsJs.abytes)(data);
      var {
        view,
        buffer,
        blockLen
      } = this;
      var len = data.length;
      var processed = false;
      for (var pos = 0; pos < len;) {
        var take = Math.min(blockLen - this.pos, len - pos);
        // Fast path only when there is no buffered partial block: `take === blockLen` implies
        // `this.pos === 0`, so we can process full blocks directly from the input view.
        if (take === blockLen) {
          var dataView = (0, _utilsJs.createView)(data);
          for (; blockLen <= len - pos; pos += blockLen) this.process(dataView, pos);
          processed = true;
          continue;
        }
        // When the whole input is buffered in one go (common for short messages), passing `data`
        // directly avoids allocating a subarray view.
        buffer.set(pos === 0 && take === len ? data : data.subarray(pos, pos + take), this.pos);
        this.pos += take;
        pos += take;
        if (this.pos === blockLen) {
          this.process(view, 0);
          this.pos = 0;
          processed = true;
        }
      }
      this.length += data.length;
      // Shared schedule buffers only pick up input-derived words inside process(); if everything
      // was buffered without processing, there is nothing to zero.
      if (processed) this.roundClean();
      return this;
    }
    digestInto(out) {
      (0, _utilsJs.aexists)(this);
      (0, _utilsJs.aoutput)(out, this);
      this.finished = true;
      // Padding
      // We can avoid allocation of buffer for padding completely if it
      // was previously not allocated here. But it won't change performance.
      var {
        buffer,
        view,
        blockLen,
        isLE
      } = this;
      var {
        pos
      } = this;
      // append the bit '1' to the message, then zero-pad the rest of the block
      buffer[pos++] = 0b10000000;
      buffer.fill(0, pos);
      // we have less than padOffset left in buffer, so we cannot put length in
      // current block, need process it and pad again
      if (this.padOffset > blockLen - pos) {
        this.process(view, 0);
        buffer.fill(0);
      }
      // `padOffset` reserves the whole length field. For SHA-384/512 the high 64 bits stay zero from
      // the padding fill above, and JS will overflow before user input can make that half non-zero.
      // So we only need to write the low 64 bits here (`length * 8` only scales the exponent of an
      // integer below 2**53, so the split inside the helper stays exact).
      (0, _u64Js.setU64FromNum)(view, blockLen - 8, this.length * 8, isLE);
      this.process(view, 0);
      // The final block above is processed outside update(), so the shared message-schedule
      // buffers (e.g. SHA256_W) would otherwise retain input-derived words after digest().
      this.roundClean();
      // digest() passes our own `buffer` as `out`; reuse its cached view instead of allocating one.
      var oview = out === buffer ? view : (0, _utilsJs.createView)(out);
      var len = this.outputLen;
      // NOTE: we do division by 4 later, which must be fused in single op with modulo by JIT
      var outLen = len / 4;
      var state = this.get();
      // Subclass-misconfiguration invariant: outputLen must be 32-bit aligned and fit the state.
      if (len % 4 || outLen > state.length) throw new Error('invalid outputLen');
      for (var i = 0; i < outLen; i++) oview.setUint32(4 * i, state[i], isLE);
    }
    digest() {
      var {
        buffer,
        outputLen
      } = this;
      this.digestInto(buffer);
      // Copy before destroy(): subclasses wipe `buffer` during cleanup, but `digest()` must return
      // fresh bytes to the caller.
      var res = buffer.slice(0, outputLen);
      this.destroy();
      return res;
    }
    _cloneIntoMeta(to) {
      var {
        buffer,
        length,
        finished,
        destroyed,
        pos
      } = this;
      to.destroyed = destroyed;
      to.finished = finished;
      to.length = length;
      to.pos = pos;
      // Only partial-block bytes need copying: when `length % blockLen === 0`, `pos === 0` and
      // later `update()` / `digestInto()` overwrite `to.buffer` from the start before reading it.
      if (pos) to.buffer.set(buffer); // Avoid a hot modulo guard.
      return to;
    }
    clone() {
      return this._cloneInto();
    }
  }
  /**
   * Initial SHA-2 state: fractional parts of square roots of first 16 primes 2..53.
   * Check out `test/misc/sha2-gen-iv.js` for recomputation guide.
   */
  /** Initial SHA256 state from RFC 6234 §6.1: the first 32 bits of the fractional parts of the
   * square roots of the first eight prime numbers. Exported as a shared table; callers must treat
   * it as read-only because constructors copy words from it by index. */
  var SHA256_IV = /* @__PURE__ */Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  /** Initial SHA224 state `H(0)` from RFC 6234 §6.1. Exported as a shared table; callers must
   * treat it as read-only because constructors copy words from it by index. */
  var SHA224_IV = /* @__PURE__ */Uint32Array.from([0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4]);
  /** Initial SHA384 state from RFC 6234 §6.3: eight RFC 64-bit `H(0)` words stored as sixteen
   * big-endian 32-bit halves. Derived from the fractional parts of the square roots of the ninth
   * through sixteenth prime numbers. Exported as a shared table; callers must treat it as read-only
   * because constructors copy halves from it by index. */
  var SHA384_IV = /* @__PURE__ */Uint32Array.from([0xcbbb9d5d, 0xc1059ed8, 0x629a292a, 0x367cd507, 0x9159015a, 0x3070dd17, 0x152fecd8, 0xf70e5939, 0x67332667, 0xffc00b31, 0x8eb44a87, 0x68581511, 0xdb0c2e0d, 0x64f98fa7, 0x47b5481d, 0xbefa4fa4]);
  /** Initial SHA512 state from RFC 6234 §6.3: eight RFC 64-bit `H(0)` words stored as sixteen
   * big-endian 32-bit halves. Derived from the fractional parts of the square roots of the first
   * eight prime numbers. Exported as a shared table; callers must treat it as read-only because
   * constructors copy halves from it by index. */
  var SHA512_IV = /* @__PURE__ */Uint32Array.from([0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b, 0xa54ff53a, 0x5f1d36f1, 0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f, 0x1f83d9ab, 0xfb41bd6b, 0x5be0cd19, 0x137e2179]);
},7,[8,9]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "add", {
    enumerable: true,
    get: function () {
      return add;
    }
  });
  Object.defineProperty(exports, "add3H", {
    enumerable: true,
    get: function () {
      return add3H;
    }
  });
  Object.defineProperty(exports, "add3L", {
    enumerable: true,
    get: function () {
      return add3L;
    }
  });
  Object.defineProperty(exports, "add4H", {
    enumerable: true,
    get: function () {
      return add4H;
    }
  });
  Object.defineProperty(exports, "add4L", {
    enumerable: true,
    get: function () {
      return add4L;
    }
  });
  Object.defineProperty(exports, "add5H", {
    enumerable: true,
    get: function () {
      return add5H;
    }
  });
  Object.defineProperty(exports, "add5L", {
    enumerable: true,
    get: function () {
      return add5L;
    }
  });
  Object.defineProperty(exports, "fromBig", {
    enumerable: true,
    get: function () {
      return fromBig;
    }
  });
  Object.defineProperty(exports, "fromNumH", {
    enumerable: true,
    get: function () {
      return fromNumH;
    }
  });
  Object.defineProperty(exports, "fromNumL", {
    enumerable: true,
    get: function () {
      return fromNumL;
    }
  });
  Object.defineProperty(exports, "rotr32H", {
    enumerable: true,
    get: function () {
      return rotr32H;
    }
  });
  Object.defineProperty(exports, "rotr32L", {
    enumerable: true,
    get: function () {
      return rotr32L;
    }
  });
  Object.defineProperty(exports, "rotrBH", {
    enumerable: true,
    get: function () {
      return rotrBH;
    }
  });
  Object.defineProperty(exports, "rotrBL", {
    enumerable: true,
    get: function () {
      return rotrBL;
    }
  });
  Object.defineProperty(exports, "rotrSH", {
    enumerable: true,
    get: function () {
      return rotrSH;
    }
  });
  Object.defineProperty(exports, "rotrSL", {
    enumerable: true,
    get: function () {
      return rotrSL;
    }
  });
  Object.defineProperty(exports, "setU64FromNum", {
    enumerable: true,
    get: function () {
      return setU64FromNum;
    }
  });
  Object.defineProperty(exports, "shrSH", {
    enumerable: true,
    get: function () {
      return shrSH;
    }
  });
  Object.defineProperty(exports, "shrSL", {
    enumerable: true,
    get: function () {
      return shrSL;
    }
  });
  Object.defineProperty(exports, "split", {
    enumerable: true,
    get: function () {
      return split;
    }
  });
  Object.defineProperty(exports, "toBig", {
    enumerable: true,
    get: function () {
      return toBig;
    }
  });
  var U32_MASK64 = /* @__PURE__ */(() => BigInt(4294967295))();
  var _32n = /* @__PURE__ */BigInt(32);
  // Split bigint into two 32-bit halves. With `le=true`, returned fields become `{ h: low, l: high
  // }` to match little-endian word order rather than the property names.
  function fromBig(n, le = false) {
    if (le) return {
      h: Number(n & U32_MASK64),
      l: Number(n >> _32n & U32_MASK64)
    };
    return {
      h: Number(n >> _32n & U32_MASK64) | 0,
      l: Number(n & U32_MASK64) | 0
    };
  }
  // Split bigint list into `[highWords, lowWords]` when `le=false`; with `le=true`, the first array
  // holds the low halves because `fromBig(...)` swaps the semantic meaning of `h` and `l`.
  function split(lst, le = false) {
    var len = lst.length;
    var Ah = new Uint32Array(len);
    var Al = new Uint32Array(len);
    for (var i = 0; i < len; i++) {
      var {
        h,
        l
      } = fromBig(lst[i], le);
      [Ah[i], Al[i]] = [h, l];
    }
    return [Ah, Al];
  }
  // Combine explicit `(high, low)` 32-bit halves into a bigint; `>>> 0` normalizes signed JS
  // bitwise results back to uint32 first, and little-endian callers must swap.
  var toBig = (h, l) => BigInt(h >>> 0) << _32n | BigInt(l >>> 0);
  // Split a JS number into u32 halves without a BigInt allocation. Exact only for integers
  // `0 <= n < 2**53`; callers use it on byte / bit counters, which JS length math caps far below
  // that (an ArrayBuffer cannot exceed 2**53 - 1 bytes).
  var fromNumH = n => n / 4294967296 | 0;
  var fromNumL = n => n >>> 0;
  // Drop-in replacement for `view.setBigUint64(byteOffset, BigInt(n), isLE)` without the per-call
  // BigInt allocation. Same `n < 2**53` precondition as `fromNumH`/`fromNumL`.
  function setU64FromNum(view, byteOffset, n, isLE) {
    var h = fromNumH(n);
    var l = fromNumL(n);
    view.setUint32(byteOffset, isLE ? l : h, isLE);
    view.setUint32(byteOffset + 4, isLE ? h : l, isLE);
  }
  // High 32-bit half of a 64-bit logical right shift for `s` in `0..31`.
  var shrSH = (h, _l, s) => h >>> s;
  // Low 32-bit half of a 64-bit logical right shift, valid for `s` in `1..31`.
  var shrSL = (h, l, s) => h << 32 - s | l >>> s;
  // High 32-bit half of a 64-bit right rotate, valid for `s` in `1..31`.
  var rotrSH = (h, l, s) => h >>> s | l << 32 - s;
  // Low 32-bit half of a 64-bit right rotate, valid for `s` in `1..31`.
  var rotrSL = (h, l, s) => h << 32 - s | l >>> s;
  // High 32-bit half of a 64-bit right rotate, valid for `s` in `33..63`; `32` uses `rotr32*`.
  var rotrBH = (h, l, s) => h << 64 - s | l >>> s - 32;
  // Low 32-bit half of a 64-bit right rotate, valid for `s` in `33..63`; `32` uses `rotr32*`.
  var rotrBL = (h, l, s) => h >>> s - 32 | l << 64 - s;
  // High 32-bit half of a 64-bit right rotate for `s === 32`; this is just the swapped low half.
  var rotr32H = (_h, l) => l;
  // Low 32-bit half of a 64-bit right rotate for `s === 32`; this is just the swapped high half.
  var rotr32L = (h, _l) => h;
  // 64-bit left rotates (rotl*) are not defined here: sha3.ts, their only consumer, keeps
  // local copies so V8 inlines them into keccakP.
  // Add two split 64-bit words and return the split `{ h, l }` sum.
  // JS uses 32-bit signed integers for bitwise operations, so we cannot simply shift the carry out
  // of the low sum and instead use division.
  function add(Ah, Al, Bh, Bl) {
    var l = (Al >>> 0) + (Bl >>> 0);
    return {
      h: Ah + Bh + (l / 4294967296 | 0) | 0,
      l: l | 0
    };
  }
  // Addition with more than 2 elements
  // Unmasked low-word accumulator for 3-way addition; pass the raw result into `add3H(...)`.
  var add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
  // High-word finalize step for 3-way addition; `low` must be the untruncated output of `add3L(...)`.
  var add3H = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 4294967296 | 0) | 0;
  // Unmasked low-word accumulator for 4-way addition; pass the raw result into `add4H(...)`.
  var add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
  // High-word finalize step for 4-way addition; `low` must be the untruncated output of `add4L(...)`.
  var add4H = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 4294967296 | 0) | 0;
  // Unmasked low-word accumulator for 5-way addition; pass the raw result into `add5H(...)`.
  var add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
  // High-word finalize step for 5-way addition; `low` must be the untruncated output of `add5L(...)`.
  var add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 4294967296 | 0) | 0;
  // prettier-ignore
},8,[]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  exports.isBytes = isBytes;
  exports.anumber = anumber;
  exports.abool = abool;
  exports.abytes = abytes;
  exports.copyBytes = copyBytes;
  exports.ahash = ahash;
  exports.aexists = aexists;
  exports.aoutput = aoutput;
  exports.u8 = u8;
  exports.u32 = u32;
  exports.clean = clean;
  exports.createView = createView;
  exports.rotr = rotr;
  exports.rotl = rotl;
  Object.defineProperty(exports, "isLE", {
    enumerable: true,
    get: function () {
      return isLE;
    }
  });
  exports.byteSwap = byteSwap;
  Object.defineProperty(exports, "swap8IfBE", {
    enumerable: true,
    get: function () {
      return swap8IfBE;
    }
  });
  exports.byteSwap32 = byteSwap32;
  Object.defineProperty(exports, "swap32IfBE", {
    enumerable: true,
    get: function () {
      return swap32IfBE;
    }
  });
  exports.bytesToHex = bytesToHex;
  exports.hexToBytes = hexToBytes;
  exports.nextTick = nextTick;
  exports.asyncLoop = asyncLoop;
  exports.utf8ToBytes = utf8ToBytes;
  exports.kdfInputToBytes = kdfInputToBytes;
  exports.concatBytes = concatBytes;
  Object.defineProperty(exports, "validateObject", {
    enumerable: true,
    get: function () {
      return validateObject;
    }
  });
  exports.checkOpts = checkOpts;
  exports.createHasher = createHasher;
  exports.randomBytes = randomBytes;
  Object.defineProperty(exports, "oidNist", {
    enumerable: true,
    get: function () {
      return oidNist;
    }
  });
  /**
   * Checks if something is Uint8Array. Be careful: nodejs Buffer will return true.
   * @param a - value to test
   * @returns `true` when the value is a Uint8Array-compatible view.
   * @example
   * Check whether a value is a Uint8Array-compatible view.
   * ```ts
   * isBytes(new Uint8Array([1, 2, 3]));
   * ```
   */
  function isBytes(a) {
    // Plain `instanceof Uint8Array` is too strict for some Buffer / proxy / cross-realm cases.
    // The fallback still requires a real ArrayBuffer view, so plain
    // JSON-deserialized `{ constructor: ... }` spoofing is rejected, and
    // `BYTES_PER_ELEMENT === 1` keeps the fallback on byte-oriented views.
    return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === 'Uint8Array' && 'BYTES_PER_ELEMENT' in a && a.BYTES_PER_ELEMENT === 1;
  }
  // Shared error-message prefix builder. Only called on throw paths, so assert
  // success paths never pay for the string concatenation.
  var atitle = title => title ? `"${title}" ` : '';
  /**
   * Asserts something is a non-negative integer.
   * @param n - number to validate
   * @param title - label included in thrown errors
   * @returns The validated number.
   * @throws On wrong argument types. {@link TypeError}
   * @throws On wrong argument ranges or values. {@link RangeError}
   * @example
   * Validate a non-negative integer option.
   * ```ts
   * anumber(32, 'length');
   * ```
   */
  function anumber(n, title = '') {
    if (typeof n !== 'number') throw new TypeError(atitle(title) + 'expected number, got ' + typeof n);
    if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(atitle(title) + 'expected integer >= 0, got ' + n);
    return n;
  }
  /**
   * Asserts something is a boolean.
   * @param value - value to validate
   * @param title - label included in thrown errors
   * @returns The validated boolean.
   * @throws On wrong argument types. {@link TypeError}
   * @example
   * Validate a boolean option.
   * ```ts
   * abool(true, 'enableXOF');
   * ```
   */
  function abool(value, title = '') {
    if (typeof value !== 'boolean') throw new TypeError(atitle(title) + 'expected boolean, got type=' + typeof value);
    return value;
  }
  /**
   * Asserts something is Uint8Array.
   * @param value - value to validate
   * @param length - optional exact length constraint
   * @param title - label included in thrown errors
   * @returns The validated byte array.
   * @throws On wrong argument types. {@link TypeError}
   * @throws On wrong argument ranges or values. {@link RangeError}
   * @example
   * Validate that a value is a byte array.
   * ```ts
   * abytes(new Uint8Array([1, 2, 3]));
   * ```
   */
  function abytes(value, length, title = '') {
    // Success path first: this runs at the start of every update() / digestInto(), and the
    // common `abytes(data)` form must not pay for length handling it does not use.
    if (isBytes(value) && (length === undefined || value.length === length)) return value;
    // Error path: recompute freely to build the exact message.
    if (length !== undefined) anumber(length, 'length');
    var bytes = isBytes(value);
    var ofLen = length !== undefined ? ` of length ${length}` : '';
    var got = bytes ? `length=${value.length}` : `type=${typeof value}`;
    var message = atitle(title) + 'expected Uint8Array' + ofLen + ', got ' + got;
    if (!bytes) throw new TypeError(message);
    throw new RangeError(message);
  }
  /**
   * Copies bytes into a fresh Uint8Array.
   * Buffer-style slices can alias the same backing store, so callers that need ownership should copy.
   * @param bytes - source bytes to clone
   * @returns Freshly allocated copy of `bytes`.
   * @throws On wrong argument types. {@link TypeError}
   * @example
   * Clone a byte array before mutating it.
   * ```ts
   * const copy = copyBytes(new Uint8Array([1, 2, 3]));
   * ```
   */
  function copyBytes(bytes) {
    // `Uint8Array.from(...)` would also accept arrays / other typed arrays. Keep this helper strict
    // because callers use it at byte-validation boundaries before mutating the detached copy.
    return Uint8Array.from(abytes(bytes));
  }
  /**
   * Asserts something is a wrapped hash constructor.
   * @param h - hash constructor to validate
   * @throws On wrong argument types or invalid hash wrapper shape. {@link TypeError}
   * @throws On invalid hash metadata ranges or values. {@link RangeError}
   * @throws If the hash metadata allows empty outputs or block sizes. {@link Error}
   * @example
   * Validate a callable hash wrapper.
   * ```ts
   * import { ahash } from '@noble/hashes/utils.js';
   * import { sha256 } from '@noble/hashes/sha2.js';
   * ahash(sha256);
   * ```
   */
  function ahash(h) {
    if (typeof h !== 'function' || typeof h.create !== 'function') throw new TypeError('expected hash wrapped by utils.createHasher');
    anumber(h.outputLen);
    anumber(h.blockLen);
    // HMAC and KDF callers treat these as real byte lengths; allowing zero lets fake wrappers pass
    // validation and can produce empty outputs instead of failing fast.
    if (h.outputLen < 1 || h.blockLen < 1) throw new Error('hash blockLen / outputLen must be >= 1');
  }
  var aobject = (value, label) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError((label === 'object' ? '' : `"${label}" `) + 'expected object, got type=' + typeof value);
  };
  var aopts = (value, label) => {
    aobject(value, label);
    var proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new TypeError(`"${label}" expected plain object`);
    // Object.assign() treats an own "__proto__" source key as a write to the target's legacy
    // prototype setter. Reject it before merging so inherited option values cannot be injected.
    if (Object.hasOwn(value, '__proto__')) throw new TypeError(`"${label}.__proto__" is not allowed`);
  };
  /**
   * Asserts a hash instance has not been destroyed or finished.
   * @param instance - hash instance to validate
   * @param checkFinished - whether to reject finalized instances
   * @throws If the hash instance has already been destroyed or finalized. {@link Error}
   * @example
   * Validate that a hash instance is still usable.
   * ```ts
   * import { aexists } from '@noble/hashes/utils.js';
   * import { sha256 } from '@noble/hashes/sha2.js';
   * const hash = sha256.create();
   * aexists(hash);
   * ```
   */
  function aexists(instance, checkFinished = true) {
    // Runs on every update()/digestInto(); the flags are library-owned booleans, so only their
    // truthiness is checked - re-validating their type per call was pure hot-path overhead.
    if (instance.destroyed) throw new Error('hash was destroyed');
    if (checkFinished && instance.finished) throw new Error('digest() was already called');
  }
  /**
   * Asserts output is a sufficiently-sized byte array.
   * @param out - destination buffer
   * @param instance - hash instance providing output length
   * Oversized buffers are allowed; downstream code only promises to fill the first `outputLen` bytes.
   * @throws On wrong argument types. {@link TypeError}
   * @throws On wrong argument ranges or values. {@link RangeError}
   * @example
   * Validate a caller-provided digest buffer.
   * ```ts
   * import { aoutput } from '@noble/hashes/utils.js';
   * import { sha256 } from '@noble/hashes/sha2.js';
   * const hash = sha256.create();
   * aoutput(new Uint8Array(hash.outputLen), hash);
   * ```
   */
  function aoutput(out, instance) {
    abytes(out, undefined, 'output');
    // `outputLen` is a library-owned readonly number; the negated comparison keeps failing fast
    // when it is missing/NaN (comparisons with undefined/NaN are false) without an anumber() call.
    var min = instance.outputLen;
    if (!(out.length >= min)) {
      throw new RangeError('"output" expected length >= ' + min);
    }
  }
  /**
   * Casts a typed array view to Uint8Array.
   * @param arr - source typed array
   * @returns Uint8Array view over the same buffer.
   * @example
   * Reinterpret a typed array as bytes.
   * ```ts
   * u8(new Uint32Array([1, 2]));
   * ```
   */
  function u8(arr) {
    return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  /**
   * Casts a typed array view to Uint32Array.
   * `arr.byteOffset` must already be 4-byte aligned or the platform
   * Uint32Array constructor will throw.
   * @param arr - source typed array
   * @returns Uint32Array view over the same buffer.
   * @example
   * Reinterpret a byte array as 32-bit words.
   * ```ts
   * u32(new Uint8Array(8));
   * ```
   */
  function u32(arr) {
    return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
  }
  /**
   * Zeroizes typed arrays in place. Warning: JS provides no guarantees.
   * @param arrays - arrays to overwrite with zeros
   * @example
   * Zeroize sensitive buffers in place.
   * ```ts
   * clean(new Uint8Array([1, 2, 3]));
   * ```
   */
  function clean(...arrays) {
    for (var i = 0; i < arrays.length; i++) {
      arrays[i].fill(0);
    }
  }
  /**
   * Creates a DataView for byte-level manipulation.
   * @param arr - source typed array
   * @returns DataView over the same buffer region.
   * @example
   * Create a DataView over an existing buffer.
   * ```ts
   * createView(new Uint8Array(4));
   * ```
   */
  function createView(arr) {
    return new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  /**
   * Rotate-right operation for uint32 values.
   * @param word - source word
   * @param shift - shift amount in bits
   * @returns Rotated word.
   * @example
   * Rotate a 32-bit word to the right.
   * ```ts
   * rotr(0x12345678, 8);
   * ```
   */
  function rotr(word, shift) {
    return word << 32 - shift | word >>> shift;
  }
  /**
   * Rotate-left operation for uint32 values.
   * @param word - source word
   * @param shift - shift amount in bits
   * @returns Rotated word.
   * @example
   * Rotate a 32-bit word to the left.
   * ```ts
   * rotl(0x12345678, 8);
   * ```
   */
  function rotl(word, shift) {
    return word << shift | word >>> 32 - shift >>> 0;
  }
  /** Whether the current platform is little-endian. */
  var isLE = /* @__PURE__ */(() => new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44)();
  /**
   * Byte-swap operation for uint32 values.
   * @param word - source word
   * @returns Word with reversed byte order.
   * @example
   * Reverse the byte order of a 32-bit word.
   * ```ts
   * byteSwap(0x11223344);
   * ```
   */
  function byteSwap(word) {
    return word << 24 & 0xff000000 | word << 8 & 0xff0000 | word >>> 8 & 0xff00 | word >>> 24 & 0xff;
  }
  /**
   * Conditionally byte-swaps one 32-bit word on big-endian platforms.
   * @param n - source word
   * @returns Original or byte-swapped word depending on platform endianness.
   * @example
   * Normalize a 32-bit word for host endianness.
   * ```ts
   * swap8IfBE(0x11223344);
   * ```
   */
  var swap8IfBE = isLE ? n => n : n => byteSwap(n) >>> 0;
  /**
   * Byte-swaps every word of a Uint32Array in place.
   * @param arr - array to mutate
   * @returns The same array after mutation; callers pass live state arrays here.
   * @example
   * Reverse the byte order of every word in place.
   * ```ts
   * byteSwap32(new Uint32Array([0x11223344]));
   * ```
   */
  function byteSwap32(arr) {
    for (var i = 0; i < arr.length; i++) {
      arr[i] = byteSwap(arr[i]);
    }
    return arr;
  }
  /**
   * Conditionally byte-swaps a Uint32Array on big-endian platforms.
   * @param u - array to normalize for host endianness
   * @returns Original or byte-swapped array depending on platform endianness.
   *   On big-endian runtimes this mutates `u` in place via `byteSwap32(...)`.
   * @example
   * Normalize a word array for host endianness.
   * ```ts
   * swap32IfBE(new Uint32Array([0x11223344]));
   * ```
   */
  var swap32IfBE = isLE ? u => u : byteSwap32;
  // Built-in hex conversion https://caniuse.com/mdn-javascript_builtins_uint8array_fromhex
  var hasHexBuiltin = /* @__PURE__ */(() =>
  // @ts-ignore
  typeof Uint8Array.from([]).toHex === 'function' && typeof Uint8Array.fromHex === 'function')();
  // Array where index 0xf0 (240) is mapped to string 'f0'
  var hexes = /* @__PURE__ */Array.from({
    length: 256
  }, (_, i) => i.toString(16).padStart(2, '0'));
  /**
   * Convert byte array to hex string.
   * Uses the built-in function when available and assumes it matches the tested
   * fallback semantics.
   * @param bytes - bytes to encode
   * @returns Lowercase hexadecimal string.
   * @throws On wrong argument types. {@link TypeError}
   * @example
   * Convert bytes to lowercase hexadecimal.
   * ```ts
   * bytesToHex(Uint8Array.from([0xca, 0xfe, 0x01, 0x23])); // 'cafe0123'
   * ```
   */
  function bytesToHex(bytes) {
    abytes(bytes);
    // @ts-ignore
    if (hasHexBuiltin) return bytes.toHex();
    // pre-caching improves the speed 6x
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += hexes[bytes[i]];
    }
    return hex;
  }
  // Strict ASCII nibble parser: non-ASCII hex lookalikes are rejected as undefined.
  // ASCII codes: '0'..'9' = 48..57, 'A'..'F' = 65..70, 'a'..'f' = 97..102.
  // prettier-ignore
  function asciiToBase16(ch) {
    return ch >= 48 && ch <= 57 ? ch - 48 // '2' => 50-48
    : ch >= 65 && ch <= 70 ? ch - 55 // 'B' => 66-(65-10)
    : ch >= 97 && ch <= 102 ? ch - 87 // 'b' => 98-(97-10)
    : undefined;
  }
  /**
   * Convert hex string to byte array. Uses built-in function, when available.
   * @param hex - hexadecimal string to decode
   * @returns Decoded bytes.
   * @throws On wrong argument types. {@link TypeError}
   * @throws On wrong argument ranges or values. {@link RangeError}
   * @example
   * Decode lowercase hexadecimal into bytes.
   * ```ts
   * hexToBytes('cafe0123'); // Uint8Array.from([0xca, 0xfe, 0x01, 0x23])
   * ```
   */
  function hexToBytes(hex) {
    if (typeof hex !== 'string') throw new TypeError('hex string expected, got ' + typeof hex);
    if (hasHexBuiltin) {
      try {
        return Uint8Array.fromHex(hex);
      } catch (error) {
        if (error instanceof SyntaxError) throw new RangeError(error.message);
        throw error;
      }
    }
    var hl = hex.length;
    var al = hl / 2;
    if (hl % 2) throw new RangeError('hex string expected, got unpadded hex of length ' + hl);
    var array = new Uint8Array(al);
    for (var ai = 0, hi = 0; ai < al; ai++, hi += 2) {
      var n1 = asciiToBase16(hex.charCodeAt(hi)); // parse first char, multiply it by 16
      var n2 = asciiToBase16(hex.charCodeAt(hi + 1)); // parse second char
      if (n1 === undefined || n2 === undefined) {
        var char = hex[hi] + hex[hi + 1];
        throw new RangeError('hex string expected, got non-hex character "' + char + '" at index ' + hi);
      }
      array[ai] = n1 * 16 + n2; // example: 'A9' => 10*16 + 9
    }
    return array;
  }
  /**
   * Yields to the host task scheduler so timers, I/O, and rendering can make progress.
   * Uses the Web Scheduling API when available or `setTimeout` as a cross-platform fallback.
   * Host-task yields are much slower than microtasks (roughly 1ms with the timer fallback), so
   * async loops should use `asyncTick >= 10` to amortize scheduling overhead to about 10% while
   * still allowing other event-loop work to proceed.
   * @param onReject - optional cleanup invoked only if the host yield fails
   * @example
   * Yield to the next scheduler tick.
   * ```ts
   * await nextTick();
   * ```
   */
  function nextTick(onReject) {
    var host = globalThis;
    if (typeof host.scheduler?.yield === 'function') {
      var promise = host.scheduler.yield();
      // Keep the original scheduler rejection; this handler exists only for cleanup.
      if (onReject) promise.catch(onReject);
      return promise;
    }
    return new Promise(resolve => host.setTimeout(resolve, 0));
  }
  /**
   * Returns control to the host event loop every `tick` milliseconds to avoid blocking long loops.
   * @param iters - number of loop iterations to run
   * @param tick - maximum time slice in milliseconds
   * @param cb - callback executed on each iteration
   * @param onReject - optional cleanup invoked only if a host yield fails
   * @throws On wrong argument types. {@link TypeError}
   * @throws On wrong argument ranges or values. {@link RangeError}
   * @example
   * Run a loop that periodically yields back to the event loop.
   * ```ts
   * await asyncLoop(2, 0, () => {});
   * ```
   */
  async function asyncLoop(iters, tick, cb, onReject) {
    anumber(iters, 'iters');
    anumber(tick, 'tick');
    if (typeof cb !== 'function') throw new TypeError('callback must be a function');
    // Callback is synchronous by contract; asyncLoop only yields between sync work windows.
    var ts = Date.now();
    for (var i = 0; i < iters; i++) {
      cb(i);
      // Date.now() is not monotonic, so in case if clock goes backwards we return return control too
      var diff = Date.now() - ts;
      if (diff >= 0 && diff < tick) continue;
      await nextTick(onReject);
      // Track only synchronous work time; scheduler delay after yielding is outside our budget.
      ts = Date.now();
    }
  }
  /**
   * Converts string to bytes using UTF8 encoding.
   * Built-in doesn't validate input to be string: we do the check.
   * Non-ASCII details are delegated to the platform `TextEncoder`.
   * @param str - string to encode
   * @returns UTF-8 encoded bytes.
   * @throws On wrong argument types. {@link TypeError}
   * @example
   * Encode a string as UTF-8 bytes.
   * ```ts
   * utf8ToBytes('abc'); // Uint8Array.from([97, 98, 99])
   * ```
   */
  function utf8ToBytes(str) {
    if (typeof str !== 'string') throw new TypeError('string expected');
    var encoded = new TextEncoder().encode(str);
    try {
      // Copy into the current realm for Firefox extension contexts. Callers that own the returned
      // buffer can then wipe it independently of TextEncoder's temporary result.
      return new Uint8Array(encoded); // https://bugzil.la/1681809
    } finally {
      clean(encoded);
    }
  }
  /**
   * Helper for KDFs: consumes Uint8Array or string.
   * String inputs are UTF-8 encoded; byte-array inputs stay aliased to the caller buffer.
   * @param data - user-provided KDF input
   * @param errorTitle - label included in thrown errors
   * @returns Byte representation of the input.
   * @throws On wrong argument types. {@link TypeError}
   * @example
   * Normalize KDF input to bytes.
   * ```ts
   * kdfInputToBytes('password');
   * ```
   */
  function kdfInputToBytes(data, errorTitle = '') {
    if (typeof data === 'string') return utf8ToBytes(data);
    return abytes(data, undefined, errorTitle);
  }
  /**
   * Copies several Uint8Arrays into one.
   * @param arrays - arrays to concatenate
   * @returns Concatenated byte array.
   * @throws On wrong argument types. {@link TypeError}
   * @example
   * Concatenate multiple byte arrays.
   * ```ts
   * concatBytes(new Uint8Array([1]), new Uint8Array([2]));
   * ```
   */
  function concatBytes(...arrays) {
    var sum = 0;
    for (var i = 0; i < arrays.length; i++) {
      var a = arrays[i];
      abytes(a);
      sum += a.length;
    }
    var res = new Uint8Array(sum);
    for (var _i = 0, pad = 0; _i < arrays.length; _i++) {
      var _a = arrays[_i];
      res.set(_a, pad);
      pad += _a.length;
    }
    return res;
  }
  /**
   * Validates declared required and optional field types on a plain object.
   * This walks field schemas and formats detailed errors, so avoid it on hot paths; use direct
   * one-line guards such as `abytes()`, `abool()`, or `anumber()` instead.
   * @param object - object to validate
   * @param fields - map of required field names to expected types
   * @param optFields - map of optional field names to expected types
   * @param title - label included in thrown errors
   * @throws On wrong argument types. {@link TypeError}
   * @example
   * Validate required and optional option fields.
   * ```ts
   * validateObject({ N: 1024, dkLen: 32 }, { N: 'number' }, { dkLen: 'number' });
   * ```
   */
  var validateObject = (object, fields = {}, optFields = {}, title = 'object') => {
    aobject(object, title);
    aobject(fields, 'fields');
    aobject(optFields, 'optFields');
    function checkField(fieldName, expectedType, isOpt) {
      var label = title === 'object' ? `param "${String(fieldName)}"` : `"${title}.${String(fieldName)}"`;
      // Config fields must be explicit own properties. Optional inherited values are rejected too
      // because callers keep reading the same options object after validation.
      var val = object[fieldName];
      // Runtime objects such as Field instances intentionally satisfy required method slots
      // via their shared prototype.
      if (!Object.hasOwn(object, fieldName) && (isOpt ? val !== undefined : expectedType !== 'function')) {
        throw new TypeError(`${label} is invalid: expected own property`);
      }
      if (isOpt && val === undefined) return;
      var current = typeof val;
      if (current !== expectedType || val === null) throw new TypeError(`${label} is invalid: expected ${expectedType}, got ${current}`);
    }
    var iter = (f, isOpt) => Object.entries(f).forEach(([k, v]) => checkField(k, v, isOpt));
    iter(fields, false);
    iter(optFields, true);
  };
  /**
   * Merges default options and passed options.
   * @param defaults - base option object
   * @param opts - user overrides
   * @param title - label included in thrown override errors
   * @returns Fresh merged option object with a null prototype.
   * @throws On wrong argument types. {@link TypeError}
   * @example
   * Merge user overrides onto default options.
   * ```ts
   * checkOpts({ dkLen: 32 }, { asyncTick: 10 });
   * ```
   */
  function checkOpts(defaults, opts, title = 'opts') {
    aopts(defaults, 'defaults');
    if (opts !== undefined) aopts(opts, title);
    // Callers read optional fields directly, so omitted values must not fall through to ambient
    // Object.prototype pollution (for example a forged `dkLen` changing SHAKE's default output).
    var merged = Object.assign(Object.create(null), defaults, opts);
    return merged;
  }
  /**
   * Creates a callable hash function from a stateful class constructor.
   * @param hashCons - hash constructor or factory
   * @param info - optional metadata such as DER OID
   * @returns Frozen callable hash wrapper with `.create()`.
   *   Wrapper construction eagerly calls `hashCons(undefined)` once to read
   *   `outputLen` / `blockLen`, so constructor side effects happen at module
   *   init time.
   * @throws On wrong argument types. {@link TypeError}
   * @example
   * Wrap a stateful hash constructor into a callable helper.
   * ```ts
   * import { createHasher } from '@noble/hashes/utils.js';
   * import { sha256 } from '@noble/hashes/sha2.js';
   * const wrapped = createHasher(sha256.create, { oid: sha256.oid });
   * wrapped(new Uint8Array([1]));
   * ```
   */
  function createHasher(hashCons, info = {}) {
    if (typeof hashCons !== 'function') throw new TypeError('"hashCons" expected function, got type=' + typeof hashCons);
    info = checkOpts({}, info, 'info');
    var hashC = (msg, opts) => hashCons(opts).update(msg).digest();
    var tmp = hashCons(undefined);
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.canXOF = tmp.canXOF;
    hashC.create = opts => hashCons(opts);
    Object.assign(hashC, info);
    return Object.freeze(hashC);
  }
  /**
   * Cryptographically secure PRNG backed by `crypto.getRandomValues`.
   * @param bytesLength - number of random bytes to generate
   * @returns Random bytes.
   * The platform `getRandomValues()` implementation still defines any
   * single-call length cap, and this helper rejects oversize requests
   * with a stable library `RangeError` instead of host-specific errors.
   * @throws On wrong argument types. {@link TypeError}
   * @throws On wrong argument ranges or values. {@link RangeError}
   * @throws If the current runtime does not provide `crypto.getRandomValues`. {@link Error}
   * @example
   * Generate a fresh random key or nonce.
   * ```ts
   * const key = randomBytes(16);
   * ```
   */
  function randomBytes(bytesLength = 32) {
    // Match the repo's other length-taking helpers instead of relying on Uint8Array coercion.
    anumber(bytesLength, 'bytesLength');
    var cr = typeof globalThis === 'object' ? globalThis.crypto : null;
    if (typeof cr?.getRandomValues !== 'function') throw new Error('crypto.getRandomValues must be defined');
    // Web Cryptography API Level 2 §10.1.1:
    // if `byteLength > 65536`, throw `QuotaExceededError`.
    // Keep the guard explicit so callers can see the quota in code
    // instead of discovering it by reading the spec or host errors.
    // This wrapper surfaces the same quota as a stable library RangeError.
    if (bytesLength > 65536) throw new RangeError(`"bytesLength" expected <= 65536, got ${bytesLength}`);
    return cr.getRandomValues(new Uint8Array(bytesLength));
  }
  /**
   * Creates OID metadata for NIST hashes with prefix `06 09 60 86 48 01 65 03 04 02`.
   * @param suffix - final OID byte for the selected hash.
   *   The helper accepts any byte even though only the documented NIST hash
   *   suffixes are meaningful downstream.
   * @returns Object containing the DER-encoded OID.
   * @example
   * Build OID metadata for a NIST hash.
   * ```ts
   * oidNist(0x01);
   * ```
   */
  var oidNist = suffix => ({
    // Current NIST hashAlgs suffixes used here fit in one DER subidentifier octet.
    // Larger suffix values would need base-128 OID encoding and a different length byte.
    oid: Uint8Array.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, suffix])
  });
},9,[]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "SCHEMA_VERSION", {
    enumerable: true,
    get: function () {
      return SCHEMA_VERSION;
    }
  });
  Object.defineProperty(exports, "VALIDATION_STATUSES", {
    enumerable: true,
    get: function () {
      return VALIDATION_STATUSES;
    }
  });
  Object.defineProperty(exports, "ACCEPTED_FOR_WORLD_CREATION", {
    enumerable: true,
    get: function () {
      return ACCEPTED_FOR_WORLD_CREATION;
    }
  });
  Object.defineProperty(exports, "SOURCE_KINDS", {
    enumerable: true,
    get: function () {
      return SOURCE_KINDS;
    }
  });
  Object.defineProperty(exports, "ManifestFormatError", {
    enumerable: true,
    get: function () {
      return ManifestFormatError;
    }
  });
  Object.defineProperty(exports, "ManifestTamperError", {
    enumerable: true,
    get: function () {
      return ManifestTamperError;
    }
  });
  Object.defineProperty(exports, "UnsupportedSchemaVersionError", {
    enumerable: true,
    get: function () {
      return UnsupportedSchemaVersionError;
    }
  });
  Object.defineProperty(exports, "asRecord", {
    enumerable: true,
    get: function () {
      return asRecord;
    }
  });
  Object.defineProperty(exports, "requireExactKeys", {
    enumerable: true,
    get: function () {
      return requireExactKeys;
    }
  });
  Object.defineProperty(exports, "asString", {
    enumerable: true,
    get: function () {
      return asString;
    }
  });
  Object.defineProperty(exports, "asSafeInt", {
    enumerable: true,
    get: function () {
      return asSafeInt;
    }
  });
  Object.defineProperty(exports, "parseProvenance", {
    enumerable: true,
    get: function () {
      return parseProvenance;
    }
  });
  Object.defineProperty(exports, "parseProvenanceList", {
    enumerable: true,
    get: function () {
      return parseProvenanceList;
    }
  });
  Object.defineProperty(exports, "unacceptableProvenance", {
    enumerable: true,
    get: function () {
      return unacceptableProvenance;
    }
  });
  Object.defineProperty(exports, "requireSupportedSchema", {
    enumerable: true,
    get: function () {
      return requireSupportedSchema;
    }
  });
  var _simDate = require(_dependencyMap[0]);
  /** Authoritative on-disk/package schema version. Unsupported versions fail closed. */
  var SCHEMA_VERSION = 1;
  var VALIDATION_STATUSES = ['synthetic', 'verified', 'unverified', 'conflicted'];
  /** Only these may seed a world: synthetic fixtures or reconciled/verified sources. */
  var ACCEPTED_FOR_WORLD_CREATION = ['synthetic', 'verified'];
  var SOURCE_KINDS = ['synthetic', 'licensed', 'public', 'derived'];
  /** Package/manifest is structurally invalid. */
  class ManifestFormatError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ManifestFormatError';
    }
  }

  /** Embedded content hash does not match the canonical body: the manifest was altered. */
  class ManifestTamperError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ManifestTamperError';
    }
  }

  /** A newer (or unknown) schema version was found. We never guess; we fail explicitly. */
  class UnsupportedSchemaVersionError extends Error {
    constructor(what, found) {
      super(`Unsupported ${what} schema version ${String(found)}; this build supports only version ${SCHEMA_VERSION}`);
      this.name = 'UnsupportedSchemaVersionError';
      this.found = found;
    }
  }

  // ---------------------------------------------------------------- shape helpers

  var asRecord = (value, what) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ManifestFormatError(`${what} must be an object`);
    }
    return value;
  };
  var requireExactKeys = (rec, required, optional, what) => {
    for (var key of required) {
      if (!(key in rec) || rec[key] === undefined) {
        throw new ManifestFormatError(`${what}: missing field "${key}"`);
      }
    }
    var allowed = new Set([...required, ...optional]);
    for (var _key of Object.keys(rec)) {
      if (!allowed.has(_key)) throw new ManifestFormatError(`${what}: unexpected field "${_key}"`);
    }
  };
  var asString = (value, what, maxLen = 256) => {
    if (typeof value !== 'string' || value.length === 0 || value.length > maxLen) {
      throw new ManifestFormatError(`${what} must be a non-empty string (max ${maxLen})`);
    }
    return value;
  };
  var asSafeInt = (value, what, min, max) => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
      throw new ManifestFormatError(`${what} must be an integer in [${min}, ${max}]`);
    }
    return value;
  };
  var INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  var parseProvenance = (value, what = 'provenance') => {
    var rec = asRecord(value, what);
    requireExactKeys(rec, ['sourceId', 'sourceKind', 'retrievedAt', 'effectiveAsOf', 'validationStatus'], ['note'], what);
    var sourceKind = rec.sourceKind;
    if (!SOURCE_KINDS.includes(sourceKind)) {
      throw new ManifestFormatError(`${what}.sourceKind is not recognized`);
    }
    var status = rec.validationStatus;
    if (!VALIDATION_STATUSES.includes(status)) {
      throw new ManifestFormatError(`${what}.validationStatus is not recognized`);
    }
    var retrievedAt = asString(rec.retrievedAt, `${what}.retrievedAt`, 20);
    if (!INSTANT.test(retrievedAt)) {
      throw new ManifestFormatError(`${what}.retrievedAt must be YYYY-MM-DDTHH:MM:SSZ`);
    }
    var effectiveAsOf = asString(rec.effectiveAsOf, `${what}.effectiveAsOf`, 10);
    if (!_simDate.SimDate.isValidISO(effectiveAsOf)) {
      throw new ManifestFormatError(`${what}.effectiveAsOf must be a valid YYYY-MM-DD date`);
    }
    var out = {
      sourceId: asString(rec.sourceId, `${what}.sourceId`),
      sourceKind: sourceKind,
      retrievedAt,
      effectiveAsOf,
      validationStatus: status
    };
    if (rec.note !== undefined) out.note = asString(rec.note, `${what}.note`, 1024);
    return out;
  };
  var parseProvenanceList = (value, what) => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new ManifestFormatError(`${what} must be a non-empty array`);
    }
    return value.map((p, i) => parseProvenance(p, `${what}[${i}]`));
  };
  var unacceptableProvenance = (list, owner) => list.filter(p => !ACCEPTED_FOR_WORLD_CREATION.includes(p.validationStatus)).map(p => ({
    code: 'PROVENANCE_NOT_ACCEPTABLE',
    message: `${owner} source "${p.sourceId}" has status "${p.validationStatus}"; only synthetic or verified sources may create a world`
  }));

  /** Reads schemaVersion off an untrusted manifest and fails closed unless it equals 1. */
  var requireSupportedSchema = (rec, what) => {
    var v = rec.schemaVersion;
    if (v === SCHEMA_VERSION) return;
    if (typeof v === 'number' && Number.isInteger(v)) throw new UnsupportedSchemaVersionError(what, v);
    throw new ManifestFormatError(`${what}: schemaVersion missing or not an integer`);
  };
},10,[3]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "sealRuleset", {
    enumerable: true,
    get: function () {
      return sealRuleset;
    }
  });
  Object.defineProperty(exports, "validateRulesetManifest", {
    enumerable: true,
    get: function () {
      return validateRulesetManifest;
    }
  });
  Object.defineProperty(exports, "rulesetRefOf", {
    enumerable: true,
    get: function () {
      return rulesetRefOf;
    }
  });
  var _hash = require(_dependencyMap[0]);
  var _ids = require(_dependencyMap[1]);
  var _provenance = require(_dependencyMap[2]);
  /** Package A ruleset content is intentionally tiny and non-football. */

  var BODY_KEYS = ['schemaVersion', 'rulesetId', 'rulesetVersion', 'displayName', 'provenance', 'rules'];
  var parseBody = rec => {
    var rulesId = (0, _provenance.asString)(rec.rulesetId, 'ruleset.rulesetId', 128);
    if (!(0, _ids.isValidId)(rulesId)) throw new _provenance.ManifestFormatError('ruleset.rulesetId is not a valid id');
    var rules = (0, _provenance.asRecord)(rec.rules, 'ruleset.rules');
    (0, _provenance.requireExactKeys)(rules, ['maxAdvanceDaysPerCommand'], [], 'ruleset.rules');
    return {
      schemaVersion: _provenance.SCHEMA_VERSION,
      rulesetId: rulesId,
      rulesetVersion: (0, _provenance.asSafeInt)(rec.rulesetVersion, 'ruleset.rulesetVersion', 1, 1_000_000),
      displayName: (0, _provenance.asString)(rec.displayName, 'ruleset.displayName', 200),
      provenance: (0, _provenance.parseProvenanceList)(rec.provenance, 'ruleset.provenance'),
      rules: {
        maxAdvanceDaysPerCommand: (0, _provenance.asSafeInt)(rules.maxAdvanceDaysPerCommand, 'rules.maxAdvanceDaysPerCommand', 1, 3650)
      }
    };
  };
  var bodyOf = m => ({
    schemaVersion: m.schemaVersion,
    rulesetId: m.rulesetId,
    rulesetVersion: m.rulesetVersion,
    displayName: m.displayName,
    provenance: m.provenance,
    rules: m.rules
  });

  /** Validate an unsealed body and attach its content hash. */
  var sealRuleset = body => {
    var rec = (0, _provenance.asRecord)(body, 'ruleset body');
    (0, _provenance.requireExactKeys)(rec, BODY_KEYS, [], 'ruleset body');
    (0, _provenance.requireSupportedSchema)(rec, 'ruleset');
    var parsed = parseBody(rec);
    return {
      ...parsed,
      contentHash: (0, _hash.hashCanonical)(bodyOf(parsed))
    };
  };

  /**
   * Parse + verify an untrusted manifest. Throws:
   *  - UnsupportedSchemaVersionError for a future/unknown schemaVersion,
   *  - ManifestFormatError for structural problems,
   *  - ManifestTamperError if the embedded hash does not match the body.
   */
  var validateRulesetManifest = value => {
    var rec = (0, _provenance.asRecord)(value, 'ruleset manifest');
    (0, _provenance.requireSupportedSchema)(rec, 'ruleset');
    (0, _provenance.requireExactKeys)(rec, [...BODY_KEYS, 'contentHash'], [], 'ruleset manifest');
    var stored = rec.contentHash;
    if (!(0, _hash.isHash)(stored)) throw new _provenance.ManifestFormatError('ruleset.contentHash must be 64 lowercase hex chars');
    var parsed = parseBody(rec);
    if ((0, _hash.hashCanonical)(bodyOf(parsed)) !== stored) {
      throw new _provenance.ManifestTamperError(`ruleset "${parsed.rulesetId}" v${parsed.rulesetVersion}: content hash mismatch`);
    }
    return {
      ...parsed,
      contentHash: stored
    };
  };
  var rulesetRefOf = m => ({
    rulesetId: m.rulesetId,
    rulesetVersion: m.rulesetVersion,
    contentHash: m.contentHash
  });
},11,[5,2,10]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "SEED_ENTITY_KINDS", {
    enumerable: true,
    get: function () {
      return SEED_ENTITY_KINDS;
    }
  });
  Object.defineProperty(exports, "sealSeed", {
    enumerable: true,
    get: function () {
      return sealSeed;
    }
  });
  Object.defineProperty(exports, "validateSeedManifest", {
    enumerable: true,
    get: function () {
      return validateSeedManifest;
    }
  });
  Object.defineProperty(exports, "seedRefOf", {
    enumerable: true,
    get: function () {
      return seedRefOf;
    }
  });
  Object.defineProperty(exports, "validateForWorldCreation", {
    enumerable: true,
    get: function () {
      return validateForWorldCreation;
    }
  });
  var _hash = require(_dependencyMap[0]);
  var _ids = require(_dependencyMap[1]);
  var _provenance = require(_dependencyMap[2]);
  var _simDate = require(_dependencyMap[3]);
  var _ruleset = require(_dependencyMap[4]);
  var SEED_ENTITY_KINDS = ['person', 'organization'];
  var BODY_KEYS = ['schemaVersion', 'seedId', 'seedVersion', 'ruleset', 'rngSeed32', 'startDate', 'provenance', 'initialEntities'];
  var parseRulesetRef = value => {
    var rec = (0, _provenance.asRecord)(value, 'seed.ruleset');
    (0, _provenance.requireExactKeys)(rec, ['rulesetId', 'rulesetVersion', 'contentHash'], [], 'seed.ruleset');
    if (!(0, _hash.isHash)(rec.contentHash)) throw new _provenance.ManifestFormatError('seed.ruleset.contentHash must be a sha256 hex');
    return {
      rulesetId: (0, _provenance.asString)(rec.rulesetId, 'seed.ruleset.rulesetId', 128),
      rulesetVersion: (0, _provenance.asSafeInt)(rec.rulesetVersion, 'seed.ruleset.rulesetVersion', 1, 1_000_000),
      contentHash: rec.contentHash
    };
  };
  var parseEntities = value => {
    if (!Array.isArray(value)) throw new _provenance.ManifestFormatError('seed.initialEntities must be an array');
    return value.map((raw, i) => {
      var rec = (0, _provenance.asRecord)(raw, `seed.initialEntities[${i}]`);
      (0, _provenance.requireExactKeys)(rec, ['id', 'kind', 'name'], [], `seed.initialEntities[${i}]`);
      var id = (0, _provenance.asString)(rec.id, `seed.initialEntities[${i}].id`, 128);
      if (!(0, _ids.isValidId)(id)) throw new _provenance.ManifestFormatError(`seed.initialEntities[${i}].id is not a valid id`);
      if (!SEED_ENTITY_KINDS.includes(rec.kind)) {
        throw new _provenance.ManifestFormatError(`seed.initialEntities[${i}].kind is not recognized`);
      }
      return {
        id,
        kind: rec.kind,
        name: (0, _provenance.asString)(rec.name, `seed.initialEntities[${i}].name`, 200)
      };
    });
  };
  var parseBody = rec => {
    var seedId = (0, _provenance.asString)(rec.seedId, 'seed.seedId', 128);
    if (!(0, _ids.isValidId)(seedId)) throw new _provenance.ManifestFormatError('seed.seedId is not a valid id');
    var startDate = (0, _provenance.asString)(rec.startDate, 'seed.startDate', 10);
    if (!_simDate.SimDate.isValidISO(startDate)) throw new _provenance.ManifestFormatError('seed.startDate must be a valid YYYY-MM-DD');
    return {
      schemaVersion: _provenance.SCHEMA_VERSION,
      seedId,
      seedVersion: (0, _provenance.asSafeInt)(rec.seedVersion, 'seed.seedVersion', 1, 1_000_000),
      ruleset: parseRulesetRef(rec.ruleset),
      rngSeed32: (0, _provenance.asSafeInt)(rec.rngSeed32, 'seed.rngSeed32', 0, 0xffffffff),
      startDate,
      provenance: (0, _provenance.parseProvenanceList)(rec.provenance, 'seed.provenance'),
      initialEntities: parseEntities(rec.initialEntities)
    };
  };
  var bodyOf = m => ({
    schemaVersion: m.schemaVersion,
    seedId: m.seedId,
    seedVersion: m.seedVersion,
    ruleset: m.ruleset,
    rngSeed32: m.rngSeed32,
    startDate: m.startDate,
    provenance: m.provenance,
    initialEntities: m.initialEntities
  });
  var sealSeed = body => {
    var rec = (0, _provenance.asRecord)(body, 'seed body');
    (0, _provenance.requireExactKeys)(rec, BODY_KEYS, [], 'seed body');
    (0, _provenance.requireSupportedSchema)(rec, 'seed');
    var parsed = parseBody(rec);
    return {
      ...parsed,
      contentHash: (0, _hash.hashCanonical)(bodyOf(parsed))
    };
  };
  var validateSeedManifest = value => {
    var rec = (0, _provenance.asRecord)(value, 'seed manifest');
    (0, _provenance.requireSupportedSchema)(rec, 'seed');
    (0, _provenance.requireExactKeys)(rec, [...BODY_KEYS, 'contentHash'], [], 'seed manifest');
    var stored = rec.contentHash;
    if (!(0, _hash.isHash)(stored)) throw new _provenance.ManifestFormatError('seed.contentHash must be 64 lowercase hex chars');
    var parsed = parseBody(rec);
    if ((0, _hash.hashCanonical)(bodyOf(parsed)) !== stored) {
      throw new _provenance.ManifestTamperError(`seed "${parsed.seedId}" v${parsed.seedVersion}: content hash mismatch`);
    }
    return {
      ...parsed,
      contentHash: stored
    };
  };
  var seedRefOf = m => ({
    seedId: m.seedId,
    seedVersion: m.seedVersion,
    contentHash: m.contentHash
  });
  var classify = (e, prefix, hashCode) => {
    if (e instanceof _provenance.UnsupportedSchemaVersionError) {
      return {
        code: `${prefix}_UNSUPPORTED_SCHEMA`,
        message: e.message
      };
    }
    if (e instanceof _provenance.ManifestTamperError) return {
      code: hashCode,
      message: e.message
    };
    var message = e instanceof Error ? e.message : String(e);
    return {
      code: `${prefix}_MALFORMED`,
      message
    };
  };

  /**
   * A world may only be created from a seed + ruleset that are (a) structurally valid,
   * (b) untampered, (c) sourced from synthetic or verified provenance, and (d) an exact
   * seed->ruleset identity/version/hash match. Never throws; returns every issue found.
   */
  var validateForWorldCreation = (seedIn, rulesetIn) => {
    var issues = [];
    var ruleset;
    var seed;
    try {
      ruleset = (0, _ruleset.validateRulesetManifest)(rulesetIn);
    } catch (e) {
      issues.push(classify(e, 'RULESET', 'RULESET_HASH_MISMATCH'));
    }
    try {
      seed = validateSeedManifest(seedIn);
    } catch (e) {
      issues.push(classify(e, 'SEED', 'SEED_HASH_MISMATCH'));
    }
    if (ruleset) issues.push(...(0, _provenance.unacceptableProvenance)(ruleset.provenance, 'ruleset'));
    if (seed) {
      issues.push(...(0, _provenance.unacceptableProvenance)(seed.provenance, 'seed'));
      var seen = new Set();
      for (var entity of seed.initialEntities) {
        if (seen.has(entity.id)) {
          issues.push({
            code: 'SEED_DUPLICATE_ENTITY',
            message: `duplicate initial entity id "${entity.id}"`
          });
        }
        seen.add(entity.id);
      }
    }
    if (ruleset && seed) {
      var ref = seed.ruleset;
      if (ref.rulesetId !== ruleset.rulesetId || ref.rulesetVersion !== ruleset.rulesetVersion || ref.contentHash !== ruleset.contentHash) {
        issues.push({
          code: 'SEED_RULESET_MISMATCH',
          message: `seed targets ruleset ${ref.rulesetId} v${ref.rulesetVersion} (${ref.contentHash.slice(0, 12)}), but ${ruleset.rulesetId} v${ruleset.rulesetVersion} (${ruleset.contentHash.slice(0, 12)}) was supplied`
        });
      }
    }
    return issues.length === 0 ? {
      ok: true
    } : {
      ok: false,
      issues
    };
  };
},12,[5,2,10,3,11]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "RNG_ALGORITHM", {
    enumerable: true,
    get: function () {
      return RNG_ALGORITHM;
    }
  });
  Object.defineProperty(exports, "DeterministicRng", {
    enumerable: true,
    get: function () {
      return DeterministicRng;
    }
  });
  /**
   * Versioned deterministic RNG: xoshiro128** (Blackman & Vigna) with explicit 32-bit math.
   *
   * Algorithm id `xoshiro128ss-v1` fixes BOTH the generator and the seeding contract:
   *   seed32 -> four state words via splitmix32 (a += 0x9e3779b9; avalanche), in order s0..s3.
   *   An all-zero expansion (practically impossible) is repaired by setting s0 = 1.
   * Changing either requires a new algorithm id and a save-schema migration; never edit in place.
   *
   * No Math.random(), no clock, no platform entropy. Identical on Node and Hermes because every
   * operation is a 32-bit integer op (`Math.imul`, shifts, xor) normalized to unsigned.
   */
  var RNG_ALGORITHM = 'xoshiro128ss-v1';
  var TWO_32 = 0x100000000;
  var isU32 = n => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 0xffffffff && !Object.is(n, -0);
  var rotl = (x, k) => x << k | x >>> 32 - k;
  var splitmix32Next = state => {
    var a = state + 0x9e3779b9 >>> 0;
    var t = a ^ a >>> 16;
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    return {
      state: a,
      value: (t ^ t >>> 15) >>> 0
    };
  };
  var validateState = state => {
    if (typeof state !== 'object' || state === null || state.algorithm !== RNG_ALGORITHM) {
      throw new RangeError(`Unsupported RNG algorithm; expected ${RNG_ALGORITHM}`);
    }
    if (!isU32(state.s0) || !isU32(state.s1) || !isU32(state.s2) || !isU32(state.s3)) {
      throw new RangeError('RNG state words must be uint32 integers');
    }
    if (state.s0 === 0 && state.s1 === 0 && state.s2 === 0 && state.s3 === 0) {
      throw new RangeError('RNG state must not be all zero');
    }
    if (!Number.isSafeInteger(state.draws) || state.draws < 0) {
      throw new RangeError('RNG draw counter must be a non-negative safe integer');
    }
  };
  class DeterministicRng {
    constructor(state) {
      this.s0 = state.s0;
      this.s1 = state.s1;
      this.s2 = state.s2;
      this.s3 = state.s3;
      this.draws = state.draws;
    }
    static fromSeed(seed32) {
      if (!isU32(seed32)) throw new RangeError('RNG seed must be a uint32 integer');
      var cursor = seed32;
      var words = [];
      for (var i = 0; i < 4; i++) {
        var step = splitmix32Next(cursor);
        cursor = step.state;
        words.push(step.value);
      }
      if (!words.some(w => w !== 0)) words[0] = 1;
      return new DeterministicRng({
        algorithm: RNG_ALGORITHM,
        s0: words[0],
        s1: words[1],
        s2: words[2],
        s3: words[3],
        draws: 0
      });
    }
    static fromState(state) {
      validateState(state);
      return new DeterministicRng(state);
    }

    /** Next uint32 (0 .. 2^32-1). */
    nextU32() {
      var result = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9) >>> 0;
      var t = this.s1 << 9;
      var s0 = this.s0;
      var s1 = this.s1;
      var s2 = this.s2;
      var s3 = this.s3;
      s2 ^= s0;
      s3 ^= s1;
      s1 ^= s2;
      s0 ^= s3;
      s2 ^= t;
      s3 = rotl(s3, 11);
      this.s0 = s0 >>> 0;
      this.s1 = s1 >>> 0;
      this.s2 = s2 >>> 0;
      this.s3 = s3 >>> 0;
      this.draws += 1;
      return result;
    }

    /**
     * Unbiased integer in [0, maxExclusive) via rejection sampling. Bounds are validated
     * BEFORE any draw, so invalid input consumes no RNG state. 1 <= maxExclusive <= 2^32.
     */
    nextInt(maxExclusive) {
      if (typeof maxExclusive !== 'number' || !Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > TWO_32) {
        throw new RangeError('nextInt bound must be an integer in [1, 2^32]');
      }
      var limit = Math.floor(TWO_32 / maxExclusive) * maxExclusive;
      for (;;) {
        var x = this.nextU32();
        if (x < limit) return x % maxExclusive;
      }
    }
    snapshot() {
      return {
        algorithm: RNG_ALGORITHM,
        s0: this.s0,
        s1: this.s1,
        s2: this.s2,
        s3: this.s3,
        draws: this.draws
      };
    }

    /** Replace internal state. Validates first; on failure the generator is unchanged. */
    restore(state) {
      validateState(state);
      this.s0 = state.s0;
      this.s1 = state.s1;
      this.s2 = state.s2;
      this.s3 = state.s3;
      this.draws = state.draws;
    }
  }
},13,[]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "WorldCreationError", {
    enumerable: true,
    get: function () {
      return WorldCreationError;
    }
  });
  Object.defineProperty(exports, "deepFreeze", {
    enumerable: true,
    get: function () {
      return deepFreeze;
    }
  });
  Object.defineProperty(exports, "createWorld", {
    enumerable: true,
    get: function () {
      return createWorld;
    }
  });
  Object.defineProperty(exports, "fingerprintWorld", {
    enumerable: true,
    get: function () {
      return fingerprintWorld;
    }
  });
  var _hash = require(_dependencyMap[0]);
  var _ids = require(_dependencyMap[1]);
  var _provenance = require(_dependencyMap[2]);
  var _ruleset = require(_dependencyMap[3]);
  var _rng = require(_dependencyMap[4]);
  var _seed = require(_dependencyMap[5]);
  /** Monotonic counters for ids minted by the kernel (never by the clock or platform). */

  /**
   * The single authoritative football universe snapshot.
   *
   * EVERY field here is authoritative and part of the fingerprint. There are no caches,
   * presentation fields or derived values: those live outside the world and are rebuildable.
   * Instances are deeply frozen; the kernel produces new worlds rather than mutating.
   */

  /** Platform-supplied identity source (the only impure input to world creation). */

  class WorldCreationError extends Error {
    constructor(issues) {
      super(`Cannot create world: ${issues.map(i => `${i.code} (${i.message})`).join('; ')}`);
      this.name = 'WorldCreationError';
      this.issues = issues;
    }
  }
  var deepFreeze = value => {
    if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
      Object.freeze(value);
      for (var key of Object.keys(value)) deepFreeze(value[key]);
    }
    return value;
  };
  var createWorld = (seedIn, rulesetIn, idSource) => {
    var verdict = (0, _seed.validateForWorldCreation)(seedIn, rulesetIn);
    if (!verdict.ok) throw new WorldCreationError(verdict.issues);
    var ruleset = (0, _ruleset.validateRulesetManifest)(rulesetIn);
    var seed = (0, _seed.validateSeedManifest)(seedIn);
    var entities = seed.initialEntities.map(e => ({
      id: (0, _ids.entityId)(e.id),
      kind: e.kind,
      name: e.name
    })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return deepFreeze({
      schemaVersion: _provenance.SCHEMA_VERSION,
      worldId: (0, _ids.worldId)(idSource.newWorldId()),
      ruleset: (0, _ruleset.rulesetRefOf)(ruleset),
      seed: (0, _seed.seedRefOf)(seed),
      simDate: seed.startDate,
      revision: (0, _ids.worldRevision)(0),
      rng: _rng.DeterministicRng.fromSeed(seed.rngSeed32).snapshot(),
      nextIds: {
        event: 1
      },
      entities
    });
  };

  /** SHA-256 over the canonical bytes of the ENTIRE authoritative world (domain-separated). */
  var fingerprintWorld = world => (0, _hash.hashCanonical)({
    domain: 'sport-sim/world-fingerprint',
    version: 1,
    world
  });
},14,[5,2,10,11,13,12]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "GENESIS_HASH", {
    enumerable: true,
    get: function () {
      return GENESIS_HASH;
    }
  });
  Object.defineProperty(exports, "chainEvent", {
    enumerable: true,
    get: function () {
      return chainEvent;
    }
  });
  Object.defineProperty(exports, "verifyEventChain", {
    enumerable: true,
    get: function () {
      return verifyEventChain;
    }
  });
  var _hash = require(_dependencyMap[0]);
  var _world = require(_dependencyMap[1]);
  var _ids = require(_dependencyMap[2]);
  var _simDate = require(_dependencyMap[3]);
  /** JSON-like authoritative data: integers, strings, booleans, null, arrays, plain objects. */

  /** Hash that the first event of a career chain links to. */
  var GENESIS_HASH = '0'.repeat(64);

  /** An intent submitted by an actor. Only the World Kernel can turn this into reality. */

  /** Inspectable record of how the kernel handled one command (for QA and "why" views). */

  var bodyOf = e => ({
    eventId: e.eventId,
    revision: e.revision,
    simDate: e.simDate,
    actor: e.actor,
    commandId: e.commandId,
    type: e.type,
    payload: e.payload
  });
  var hashEvent = (previousHash, body) => (0, _hash.hashCanonical)({
    previousHash,
    body: bodyOf(body)
  });
  var isBodyShaped = e => {
    if (typeof e !== 'object' || e === null) return false;
    var v = e;
    return (0, _ids.isValidId)(v.eventId) && (0, _ids.isValidRevision)(v.revision) && _simDate.SimDate.isValidISO(v.simDate) && (0, _ids.isActorRef)(v.actor) && (0, _ids.isValidId)(v.commandId) && typeof v.type === 'string' && v.type.length > 0 && v.payload !== undefined;
  };

  /** Wrap an event body into the next link of the chain. Throws on malformed input. */
  var chainEvent = (previousHash, body) => {
    if (!(0, _hash.isHash)(previousHash)) throw new TypeError('previousHash must be 64 lowercase hex chars');
    if (!isBodyShaped(body)) throw new TypeError('malformed event body');
    return (0, _world.deepFreeze)({
      ...bodyOf(body),
      previousHash,
      hash: hashEvent(previousHash, body)
    });
  };
  /**
   * Verify a chain (or a tail segment) of events. `startPreviousHash` is what the first
   * event must link to: GENESIS_HASH for a full chain, or the prior head for a tail.
   * Note that truncating the END of a chain still verifies; callers must compare the head
   * hash against the head they expect (snapshot / ledger).
   */
  var verifyEventChain = (events, startPreviousHash = GENESIS_HASH) => {
    var expectedPrevious = startPreviousHash;
    var lastRevision = -1;
    var seenIds = new Set();
    var _loop = function (index) {
        var e = events[index];
        var fail = (reason, message) => ({
          ok: false,
          index,
          reason,
          message
        });
        if (!isBodyShaped(e) || !(0, _hash.isHash)(e.previousHash) || !(0, _hash.isHash)(e.hash)) {
          return {
            v: fail('MALFORMED', `event ${index} is malformed`)
          };
        }
        if (e.previousHash !== expectedPrevious) {
          return {
            v: fail('BROKEN_LINK', `event ${index} does not link to the preceding hash`)
          };
        }
        if (hashEvent(e.previousHash, e) !== e.hash) {
          return {
            v: fail('HASH_MISMATCH', `event ${index} content does not match its hash`)
          };
        }
        if (e.revision < lastRevision) {
          return {
            v: fail('REVISION_ORDER', `event ${index} revision ${e.revision} precedes ${lastRevision}`)
          };
        }
        if (seenIds.has(e.eventId)) {
          return {
            v: fail('DUPLICATE_EVENT_ID', `event ${index} reuses id ${e.eventId}`)
          };
        }
        seenIds.add(e.eventId);
        lastRevision = e.revision;
        expectedPrevious = e.hash;
      },
      _ret;
    for (var index = 0; index < events.length; index++) {
      _ret = _loop(index);
      if (_ret) return _ret.v;
    }
    return {
      ok: true,
      headHash: expectedPrevious,
      count: events.length
    };
  };
},15,[5,14,2,3]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "WorldKernel", {
    enumerable: true,
    get: function () {
      return WorldKernel;
    }
  });
  var _audit = require(_dependencyMap[0]);
  var _hash = require(_dependencyMap[1]);
  var _ids = require(_dependencyMap[2]);
  var _rng = require(_dependencyMap[3]);
  var _ruleset = require(_dependencyMap[4]);
  var _simDate = require(_dependencyMap[5]);
  var _world = require(_dependencyMap[6]);
  /** Actors that may advance the calendar. CPU orgs and delegates may not. */
  var CALENDAR_AUTHORITY = new Set(['human_gm', 'commissioner', 'system', 'test_harness']);
  var KNOWN_COMMANDS = new Set(['AdvanceDays']);
  var eventIdFor = ordinal => (0, _ids.eventId)(`evt-${String(ordinal).padStart(6, '0')}`);

  /**
   * The only component allowed to change the world.
   * Pipeline: Intent -> Validation -> Authorization -> Resolution -> Commit -> Event.
   * Any rejection or fault leaves world, RNG, known command ids and audit chain untouched.
   */
  class WorldKernel {
    #world;
    #ruleset;
    #chainHead;
    #eventCount;
    #events = [];
    #known;
    #beforeCommit;
    constructor(world, ruleset, chainHead, eventCount, known, options) {
      var validated = (0, _ruleset.validateRulesetManifest)(ruleset);
      var ref = (0, _ruleset.rulesetRefOf)(validated);
      if (ref.rulesetId !== world.ruleset.rulesetId || ref.rulesetVersion !== world.ruleset.rulesetVersion || ref.contentHash !== world.ruleset.contentHash) {
        throw new Error('ruleset does not match the world ruleset reference');
      }
      if (!(0, _hash.isHash)(chainHead)) throw new Error('chainHead must be a 64-char lowercase hex hash');
      if (!Number.isSafeInteger(eventCount) || eventCount < 0) throw new Error('invalid eventCount');
      this.#world = world;
      this.#ruleset = validated;
      this.#chainHead = chainHead;
      this.#eventCount = eventCount;
      this.#known = new Set(known);
      this.#beforeCommit = options.beforeCommit;
    }
    static fromGenesis(world, ruleset, options = {}) {
      if (world.revision !== 0 || world.nextIds.event !== 1) {
        throw new Error('fromGenesis requires an untouched genesis world');
      }
      return new WorldKernel(world, ruleset, _audit.GENESIS_HASH, 0, [], options);
    }
    static resume(state, options = {}) {
      if (state.eventCount + 1 !== state.world.nextIds.event) {
        throw new Error('eventCount does not agree with world.nextIds.event');
      }
      return new WorldKernel(state.world, state.ruleset, state.chainHead, state.eventCount, state.knownCommandIds, options);
    }
    get world() {
      return this.#world;
    }
    get chainHead() {
      return this.#chainHead;
    }
    /** Total events ever committed for this career (not just those since resume). */
    get eventCount() {
      return this.#eventCount;
    }
    /** Events committed by this kernel instance, in order. */
    get events() {
      return this.#events;
    }
    get knownCommandIds() {
      return [...this.#known].sort();
    }
    execute(input) {
      var steps = [];
      var reject = (stage, code, message, commandId) => {
        steps.push({
          stage,
          outcome: 'fail',
          detail: `${code}: ${message}`
        });
        return {
          ok: false,
          rejection: {
            code,
            message
          },
          trace: (0, _world.deepFreeze)({
            commandId,
            steps
          })
        };
      };

      // --- Validation: envelope shape ---
      var env = input;
      if (typeof env !== 'object' || env === null || !(0, _ids.isValidId)(env.commandId) || !(0, _ids.isValidRevision)(env.expectedRevision) || !(0, _ids.isActorRef)(env.actor) || typeof env.command !== 'object' || env.command === null) {
        return reject('validation', 'SCHEMA_INVALID', 'malformed command envelope', null);
      }
      var cid = env.commandId;
      var command = env.command;
      if (typeof command.type !== 'string' || !KNOWN_COMMANDS.has(command.type)) {
        return reject('validation', 'SCHEMA_INVALID', 'unknown command type', cid);
      }
      if (this.#known.has(cid)) {
        return reject('validation', 'DUPLICATE_COMMAND', `command ${cid} was already committed`, cid);
      }
      if (env.expectedRevision !== this.#world.revision) {
        return reject('validation', 'STALE_REVISION', `expected revision ${String(env.expectedRevision)} but world is at ${this.#world.revision}`, cid);
      }
      var max = this.#ruleset.rules.maxAdvanceDaysPerCommand;
      var days = command.days;
      if (typeof days !== 'number' || !Number.isSafeInteger(days) || days < 1 || days > max) {
        return reject('validation', 'INVALID_PAYLOAD', `days must be an integer in 1..${max}`, cid);
      }
      steps.push({
        stage: 'validation',
        outcome: 'pass',
        detail: 'envelope, revision and payload valid'
      });

      // --- Authorization ---
      var actor = env.actor;
      if (!CALENDAR_AUTHORITY.has(actor.kind)) {
        return reject('authorization', 'UNAUTHORIZED_ACTOR', `${actor.kind} cannot advance the calendar`, cid);
      }
      steps.push({
        stage: 'authorization',
        outcome: 'pass',
        detail: `${actor.kind} may advance the calendar`
      });
      try {
        // --- Resolution (pure; works on copies only) ---
        var world = this.#world;
        var rng = _rng.DeterministicRng.fromState(world.rng);
        var start = _simDate.SimDate.parse(world.simDate);
        var dayRolls = [];
        for (var i = 1; i <= days; i++) {
          dayRolls.push({
            date: start.addDays(i).toISO(),
            roll: rng.nextU32()
          });
        }
        var toDate = start.addDays(days).toISO();
        steps.push({
          stage: 'resolution',
          outcome: 'pass',
          detail: `advanced ${days} day(s) to ${toDate}`
        });
        var revision = (0, _ids.worldRevision)(Number(world.revision) + 1);
        var event = (0, _audit.chainEvent)(this.#chainHead, {
          eventId: eventIdFor(world.nextIds.event),
          revision,
          simDate: toDate,
          actor,
          commandId: env.commandId,
          type: 'DaysAdvanced',
          payload: {
            fromDate: world.simDate,
            toDate,
            days,
            dayRolls
          }
        });
        var nextWorld = (0, _world.deepFreeze)({
          ...world,
          simDate: toDate,
          revision,
          rng: rng.snapshot(),
          nextIds: {
            event: world.nextIds.event + 1
          }
        });
        this.#beforeCommit?.();

        // --- Commit (all-or-nothing: nothing above has touched kernel state) ---
        steps.push({
          stage: 'commit',
          outcome: 'pass',
          detail: `committed revision ${revision}`
        });
        this.#world = nextWorld;
        this.#chainHead = event.hash;
        this.#eventCount += 1;
        this.#events.push(event);
        this.#known.add(cid);
        return {
          ok: true,
          world: nextWorld,
          events: [event],
          trace: (0, _world.deepFreeze)({
            commandId: cid,
            steps
          })
        };
      } catch (error) {
        steps.length = 2;
        return reject('commit', 'INTERNAL_ERROR', error instanceof Error ? error.message : 'unexpected failure', cid);
      }
    }
  }
},16,[15,5,2,13,11,3,14]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "PersistenceError", {
    enumerable: true,
    get: function () {
      return PersistenceError;
    }
  });
  Object.defineProperty(exports, "SNAPSHOT_RETENTION_NEWEST", {
    enumerable: true,
    get: function () {
      return SNAPSHOT_RETENTION_NEWEST;
    }
  });
  Object.defineProperty(exports, "hashSnapshotBody", {
    enumerable: true,
    get: function () {
      return hashSnapshotBody;
    }
  });
  Object.defineProperty(exports, "sealSnapshot", {
    enumerable: true,
    get: function () {
      return sealSnapshot;
    }
  });
  Object.defineProperty(exports, "verifySnapshot", {
    enumerable: true,
    get: function () {
      return verifySnapshot;
    }
  });
  Object.defineProperty(exports, "checkCommitContinuity", {
    enumerable: true,
    get: function () {
      return checkCommitContinuity;
    }
  });
  Object.defineProperty(exports, "cloneData", {
    enumerable: true,
    get: function () {
      return cloneData;
    }
  });
  Object.defineProperty(exports, "retainedRevisions", {
    enumerable: true,
    get: function () {
      return retainedRevisions;
    }
  });
  Object.defineProperty(exports, "checkRepairConsistency", {
    enumerable: true,
    get: function () {
      return checkRepairConsistency;
    }
  });
  var _canonical = require(_dependencyMap[0]);
  var _audit = require(_dependencyMap[1]);
  var _hash = require(_dependencyMap[2]);
  var _provenance = require(_dependencyMap[3]);
  var _world = require(_dependencyMap[4]);
  /**
   * Persistence contract. Everything here is plain data: nothing depends on SQLite,
   * Expo, the filesystem or the clock, so the same DTOs back every adapter.
   */

  /** Complete, self-verifying capture of a career at one revision. */

  /** A committed command, kept so replay can re-execute it through the production kernel. */

  /** Everything one atomic save writes. */

  /** Explicit record that stored data was not trusted as-is. Never produced silently. */

  class PersistenceError extends Error {
    constructor(code, message) {
      super(`${code}: ${message}`);
      this.name = 'PersistenceError';
      this.code = code;
    }
  }

  /**
   * Durable home of a single career. Implementations never decide simulation outcomes;
   * they atomically persist what the kernel already committed, and fail closed.
   *
   * Guarantees every implementation must provide (see careerStoreContractCases):
   *  - saveCommit is all-or-nothing: a failure leaves the previous active snapshot loadable.
   *  - an unsupported (future) schemaVersion is rejected on save and on load.
   *  - previous verified snapshots stay available (genesis plus the newest few).
   *  - nothing returned by a store aliases its internal state.
   */

  /** Newest snapshots retained in addition to the genesis snapshot (revision 0). */
  var SNAPSHOT_RETENTION_NEWEST = 4;
  var snapshotBody = s => ({
    schemaVersion: s.schemaVersion,
    worldId: s.worldId,
    revision: s.revision,
    eventCount: s.eventCount,
    chainHead: s.chainHead,
    worldFingerprint: s.worldFingerprint,
    knownCommandIds: s.knownCommandIds,
    world: s.world
  });
  var hashSnapshotBody = s => (0, _hash.hashCanonical)({
    domain: 'sport-sim/career-snapshot',
    version: 1,
    body: snapshotBody(s)
  });

  /** Seal kernel state into a snapshot DTO. */
  var sealSnapshot = input => {
    var body = {
      schemaVersion: _provenance.SCHEMA_VERSION,
      worldId: input.world.worldId,
      revision: input.world.revision,
      eventCount: input.eventCount,
      chainHead: input.chainHead,
      worldFingerprint: (0, _world.fingerprintWorld)(input.world),
      knownCommandIds: [...input.knownCommandIds].sort(),
      world: input.world
    };
    return (0, _world.deepFreeze)({
      ...body,
      contentHash: hashSnapshotBody(body)
    });
  };
  /**
   * Check a snapshot is internally consistent. Throws UnsupportedSchemaVersionError for a
   * future schema (a build must never interpret data it does not understand); every other
   * defect is reported as reasons so callers can recover explicitly.
   */
  var verifySnapshot = value => {
    if (typeof value !== 'object' || value === null) {
      return {
        ok: false,
        reasons: ['snapshot is not an object']
      };
    }
    var s = value;
    if (s.schemaVersion !== _provenance.SCHEMA_VERSION) {
      if (typeof s.schemaVersion === 'number' && Number.isInteger(s.schemaVersion)) {
        throw new _provenance.UnsupportedSchemaVersionError('career snapshot', s.schemaVersion);
      }
      return {
        ok: false,
        reasons: ['schemaVersion missing or not an integer']
      };
    }
    var reasons = [];
    var world = s.world;
    if (typeof world !== 'object' || world === null) {
      return {
        ok: false,
        reasons: ['world missing']
      };
    }
    if (!(0, _hash.isHash)(s.contentHash)) reasons.push('contentHash malformed');
    if (!(0, _hash.isHash)(s.chainHead)) reasons.push('chainHead malformed');
    if (!Array.isArray(s.knownCommandIds)) reasons.push('knownCommandIds malformed');
    try {
      var body = snapshotBody(s);
      (0, _canonical.canonicalString)(body);
      if (hashSnapshotBody(s) !== s.contentHash) {
        reasons.push('contentHash does not match snapshot content');
      }
      if ((0, _world.fingerprintWorld)(world) !== s.worldFingerprint) reasons.push('worldFingerprint mismatch');
    } catch (e) {
      reasons.push(`snapshot not canonical: ${e instanceof Error ? e.message : 'unknown'}`);
    }
    if (world.worldId !== s.worldId) reasons.push('worldId disagrees with world');
    if (world.revision !== s.revision) reasons.push('revision disagrees with world');
    if (world.nextIds && world.nextIds.event !== s.eventCount + 1) {
      reasons.push('eventCount disagrees with world.nextIds');
    }
    return reasons.length === 0 ? {
      ok: true
    } : {
      ok: false,
      reasons
    };
  };

  /**
   * Validate that `commit` is a legal successor of `latest` (null for the first save).
   * Shared by every adapter so they cannot drift apart. Returns the reason, or null if legal.
   */
  var checkCommitContinuity = (latest, commit, storedEventCount) => {
    var {
      snapshot,
      commands,
      events
    } = commit;
    if (storedEventCount !== (latest?.eventCount ?? 0)) {
      return 'stored history is out of step with the active snapshot; recover before saving';
    }
    var verdict = verifySnapshot(snapshot);
    if (!verdict.ok) return `snapshot invalid: ${verdict.reasons.join('; ')}`;
    if (commands.length > events.length) {
      return 'more commands than events';
    }
    if (latest === null) {
      if (snapshot.revision !== 0 || snapshot.eventCount !== 0 || events.length !== 0) {
        return 'first save must be the genesis snapshot (revision 0, no events)';
      }
      return null;
    }
    if (snapshot.worldId !== latest.worldId) return 'snapshot belongs to a different world';
    if (snapshot.revision <= latest.revision) {
      return `revision ${snapshot.revision} does not advance past ${latest.revision}`;
    }
    if (snapshot.eventCount !== latest.eventCount + events.length) {
      return 'eventCount does not equal prior count plus supplied events';
    }
    var chain = (0, _audit.verifyEventChain)(events, latest.chainHead);
    if (!chain.ok) return `event chain invalid: ${chain.reason} at ${chain.index}`;
    if (chain.headHash !== snapshot.chainHead) return 'snapshot chainHead does not match supplied events';
    for (var c of commands) {
      if (c.resultRevision <= latest.revision || c.resultRevision > snapshot.revision) {
        return 'command resultRevision outside the committed range';
      }
      if (latest.knownCommandIds.includes(c.envelope.commandId)) {
        return `command ${c.envelope.commandId} was already committed`;
      }
      if (!snapshot.knownCommandIds.includes(c.envelope.commandId)) {
        return `snapshot does not record command ${c.envelope.commandId}`;
      }
    }
    return null;
  };

  /** Plain-data deep copy via canonical JSON; frozen so callers cannot alias store state. */
  var cloneData = value => (0, _world.deepFreeze)(JSON.parse((0, _canonical.canonicalString)(value)));

  /** Revisions to keep after a save: genesis (0) plus the newest few, so replay can always start at genesis. */
  var retainedRevisions = revisions => {
    var sorted = [...revisions].sort((a, b) => a - b);
    var keep = new Set([0]);
    for (var r of sorted.slice(-4)) keep.add(r);
    return keep;
  };

  /**
   * A repaired snapshot may only be installed if it describes the stored history exactly:
   * it must cover every stored event and carry the audit head of the stored tail.
   * Returns the reason it is unacceptable, or null.
   */
  var checkRepairConsistency = (repaired, storedEventCount, storedTailHash) => {
    var verdict = verifySnapshot(repaired);
    if (!verdict.ok) return `repaired snapshot invalid: ${verdict.reasons.join('; ')}`;
    if (repaired.eventCount !== storedEventCount || repaired.chainHead !== storedTailHash) {
      return 'repaired snapshot does not match the stored history tail';
    }
    return null;
  };
},17,[4,15,5,10,14]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "MemoryCareerStore", {
    enumerable: true,
    get: function () {
      return MemoryCareerStore;
    }
  });
  var _audit = require(_dependencyMap[0]);
  var _persistence = require(_dependencyMap[1]);
  /**
   * Reference CareerStore that keeps everything in memory. It defines the behaviour every
   * real adapter must match, and lets the shared contract run without a mobile runtime.
   * Not for shipping: data does not survive a process restart.
   */
  class MemoryCareerStore {
    #initialized = false;
    #snapshots = []; // ascending by revision
    #activeRevision = null;
    #commands = [];
    #events = [];
    #recovery = [];
    #failNext = false;

    /** Test seam: the next saveCommit fails after validation, before any state changes. */
    failNextCommit() {
      this.#failNext = true;
    }

    /**
     * Test seam: replace a stored snapshot with the result of `mutate` applied to a plain
     * (unfrozen) copy, bypassing every check. Simulates on-disk corruption.
     */
    tamperWithSnapshotForTest(revision, mutate) {
      var i = this.#snapshots.findIndex(s => s.revision === revision);
      if (i < 0) throw new Error(`no snapshot at revision ${revision}`);
      var plain = JSON.parse(JSON.stringify(this.#snapshots[i]));
      this.#snapshots[i] = mutate(plain);
    }

    /** Test seam: drop the newest `count` events and the commands that produced them. */
    truncateHistoryForTest(count) {
      var removed = this.#events.slice(this.#events.length - count);
      var gone = new Set(removed.map(e => e.commandId));
      this.#events = this.#events.slice(0, this.#events.length - count);
      this.#commands = this.#commands.filter(c => !gone.has(c.envelope.commandId));
    }

    /** Test seam: rewrite one stored event (by 0-based index) without re-hashing it. */
    tamperWithEventForTest(index, mutate) {
      var plain = JSON.parse(JSON.stringify(this.#events[index]));
      this.#events = this.#events.map((e, i) => i === index ? mutate(plain) : e);
    }

    /** Plain-data copy of everything stored (for adapters that persist this store as a file). */
    exportState() {
      return (0, _persistence.cloneData)({
        snapshots: this.#snapshots,
        activeRevision: this.#activeRevision,
        commands: this.#commands,
        events: this.#events,
        recovery: this.#recovery
      });
    }

    /** Rebuild a store from exportState() output. Call initialize() before use. */
    static fromState(state) {
      var store = new MemoryCareerStore();
      var copy = (0, _persistence.cloneData)(state);
      store.#snapshots = [...copy.snapshots];
      store.#activeRevision = copy.activeRevision;
      store.#commands = [...copy.commands];
      store.#events = [...copy.events];
      store.#recovery = [...copy.recovery];
      return store;
    }
    async initialize() {
      this.#initialized = true;
    }
    #requireInit() {
      if (!this.#initialized) throw new _persistence.PersistenceError('NOT_INITIALIZED', 'call initialize() first');
    }
    #active() {
      if (this.#activeRevision === null) return null;
      return this.#snapshots.find(s => s.revision === this.#activeRevision) ?? null;
    }
    async saveCommit(input) {
      this.#requireInit();
      var commit = (0, _persistence.cloneData)(input);
      // Throws UnsupportedSchemaVersionError for a future schema (fail closed).
      (0, _persistence.verifySnapshot)(commit.snapshot);
      var reason = (0, _persistence.checkCommitContinuity)(this.#active(), commit, this.#events.length);
      if (reason !== null) throw new _persistence.PersistenceError('COMMIT_REJECTED', reason);
      if (this.#failNext) {
        this.#failNext = false;
        throw new _persistence.PersistenceError('WRITE_FAILED', 'injected fault before commit');
      }
      // Build the complete next state, then swap it in as one step.
      var snapshots = [...this.#snapshots, commit.snapshot].sort((a, b) => a.revision - b.revision);
      var keep = (0, _persistence.retainedRevisions)(snapshots.map(s => s.revision));
      var nextSnapshots = snapshots.filter(s => keep.has(s.revision));
      var nextCommands = [...this.#commands, ...commit.commands];
      var nextEvents = [...this.#events, ...commit.events];
      this.#snapshots = nextSnapshots;
      this.#commands = nextCommands;
      this.#events = nextEvents;
      this.#activeRevision = commit.snapshot.revision;
    }
    async loadLatest() {
      this.#requireInit();
      var active = this.#active();
      if (active === null) return null;
      (0, _persistence.verifySnapshot)(active); // throws for unsupported schema; other defects are Task 9's concern
      return (0, _persistence.cloneData)(active);
    }
    async listVerifiedSnapshots() {
      this.#requireInit();
      var out = [];
      for (var s of [...this.#snapshots].reverse()) {
        if ((0, _persistence.verifySnapshot)(s).ok) out.push((0, _persistence.cloneData)(s));
      }
      return out;
    }
    async loadHistorySince(revision) {
      this.#requireInit();
      return (0, _persistence.cloneData)({
        commands: this.#commands.filter(c => c.resultRevision > revision),
        events: this.#events.filter(e => e.revision > revision)
      });
    }
    async markRecovery(report, repairedSnapshot) {
      this.#requireInit();
      var entry = (0, _persistence.cloneData)(report);
      if (repairedSnapshot === undefined) {
        this.#recovery = [...this.#recovery, entry];
        return;
      }
      var repaired = (0, _persistence.cloneData)(repairedSnapshot);
      var tail = this.#events.length === 0 ? _audit.GENESIS_HASH : this.#events[this.#events.length - 1].hash;
      var problem = (0, _persistence.checkRepairConsistency)(repaired, this.#events.length, tail);
      if (problem !== null) throw new _persistence.PersistenceError('COMMIT_REJECTED', problem);
      var snapshots = [...this.#snapshots.filter(s => s.revision !== repaired.revision), repaired].sort((a, b) => a.revision - b.revision);
      this.#snapshots = snapshots;
      this.#activeRevision = repaired.revision;
      this.#recovery = [...this.#recovery, entry];
    }
    async loadRecoveryLog() {
      this.#requireInit();
      return (0, _persistence.cloneData)(this.#recovery);
    }
  }
},18,[15,17]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "careerStoreContractCases", {
    enumerable: true,
    get: function () {
      return careerStoreContractCases;
    }
  });
  Object.defineProperty(exports, "runContractCases", {
    enumerable: true,
    get: function () {
      return runContractCases;
    }
  });
  Object.defineProperty(exports, "createContractCareer", {
    enumerable: true,
    get: function () {
      return createContractCareer;
    }
  });
  var _canonical = require(_dependencyMap[0]);
  var _audit = require(_dependencyMap[1]);
  var _ids = require(_dependencyMap[2]);
  var _kernel = require(_dependencyMap[3]);
  var _persistence = require(_dependencyMap[4]);
  var _provenance = require(_dependencyMap[5]);
  var _ruleset = require(_dependencyMap[6]);
  var _seed = require(_dependencyMap[7]);
  var _world = require(_dependencyMap[8]);
  /**
   * Framework-free CareerStore contract. Any adapter (memory, SQLite, ...) must pass every
   * case. It lives in sim-core (pure TypeScript) so the SAME cases run under Vitest in Node
   * and inside the Expo/Hermes runtime. Cases throw on failure.
   */

  class ContractFailure extends Error {
    constructor(message) {
      super(`CareerStore contract violated: ${message}`);
      this.name = 'ContractFailure';
    }
  }
  var check = (condition, message) => {
    if (!condition) throw new ContractFailure(message);
  };
  var same = (actual, expected, message) => {
    var a = (0, _canonical.canonicalString)(actual);
    var e = (0, _canonical.canonicalString)(expected);
    if (a !== e) throw new ContractFailure(`${message}\n  actual:   ${a}\n  expected: ${e}`);
  };
  var rejection = async (fn, message) => {
    try {
      await fn();
    } catch (error) {
      return error;
    }
    throw new ContractFailure(`${message} (expected a rejection, got success)`);
  };

  // ---- A small synthetic career to persist -------------------------------------------

  var provenance = {
    sourceId: 'contract-fixture',
    sourceKind: 'synthetic',
    retrievedAt: '2026-10-16T00:00:00Z',
    effectiveAsOf: '2026-10-16',
    validationStatus: 'synthetic',
    note: 'persistence contract fixture'
  };
  var makeRuleset = () => (0, _ruleset.sealRuleset)({
    schemaVersion: _provenance.SCHEMA_VERSION,
    rulesetId: 'contract-ruleset',
    rulesetVersion: 1,
    displayName: 'Contract Ruleset',
    provenance: [provenance],
    rules: {
      maxAdvanceDaysPerCommand: 30
    }
  });
  var newCareer = () => {
    var ruleset = makeRuleset();
    var seed = (0, _seed.sealSeed)({
      schemaVersion: _provenance.SCHEMA_VERSION,
      seedId: 'contract-seed',
      seedVersion: 1,
      ruleset: (0, _ruleset.rulesetRefOf)(ruleset),
      rngSeed32: 777,
      startDate: '2026-10-16',
      provenance: [provenance],
      initialEntities: []
    });
    var world = (0, _world.createWorld)(seed, ruleset, {
      newWorldId: () => (0, _ids.worldId)('world-contract-1')
    });
    return {
      kernel: _kernel.WorldKernel.fromGenesis(world, ruleset),
      ruleset
    };
  };
  var snapshotOf = k => (0, _persistence.sealSnapshot)({
    world: k.world,
    chainHead: k.chainHead,
    eventCount: k.eventCount,
    knownCommandIds: k.knownCommandIds
  });
  var genesisCommit = k => ({
    snapshot: snapshotOf(k),
    commands: [],
    events: []
  });
  var envelope = (n, days, revision) => ({
    commandId: (0, _ids.commandId)(`cmd-${n}`),
    expectedRevision: (0, _ids.worldRevision)(revision),
    actor: {
      kind: 'test_harness',
      id: (0, _ids.entityId)('actor-1')
    },
    command: {
      type: 'AdvanceDays',
      days
    }
  });

  /** Run one command through the kernel and return the matching commit record. */
  var advance = (k, n, days = 1) => {
    var env = envelope(n, days, Number(k.world.revision));
    var res = k.execute(env);
    if (!res.ok) throw new ContractFailure(`fixture command rejected: ${res.rejection.message}`);
    return {
      snapshot: snapshotOf(k),
      commands: [{
        envelope: env,
        resultRevision: Number(res.world.revision)
      }],
      events: res.events
    };
  };
  var open = async factory => {
    var h = await factory();
    await h.store.initialize();
    return h;
  };

  // ---- Cases -------------------------------------------------------------------------

  var careerStoreContractCases = factory => [{
    name: 'refuses use before initialize()',
    async run() {
      var h = await factory();
      var err = await rejection(() => h.store.loadLatest(), 'loadLatest before initialize');
      check(err instanceof _persistence.PersistenceError && err.code === 'NOT_INITIALIZED', 'NOT_INITIALIZED expected');
    }
  }, {
    name: 'initialize() is idempotent and an empty store reports nothing',
    async run() {
      var h = await open(factory);
      await h.store.initialize();
      check((await h.store.loadLatest()) === null, 'empty store has no latest snapshot');
      same(await h.store.listVerifiedSnapshots(), [], 'empty store lists no snapshots');
      same(await h.store.loadHistorySince(0), {
        commands: [],
        events: []
      }, 'empty store has no history');
      same(await h.store.loadRecoveryLog(), [], 'empty store has no recovery log');
    }
  }, {
    name: 'initial save stores the genesis snapshot exactly',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      var commit = genesisCommit(kernel);
      await h.store.saveCommit(commit);
      var loaded = await h.store.loadLatest();
      same(loaded, commit.snapshot, 'loaded snapshot equals saved snapshot');
      check(loaded !== null && loaded.worldFingerprint === (0, _world.fingerprintWorld)(kernel.world), 'fingerprint kept');
      check(loaded !== null && loaded.chainHead === _audit.GENESIS_HASH, 'genesis chain head');
    }
  }, {
    name: 'the first save must be the genesis snapshot',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      var first = advance(kernel, 1);
      var err = await rejection(() => h.store.saveCommit(first), 'non-genesis first save');
      check(err instanceof _persistence.PersistenceError && err.code === 'COMMIT_REJECTED', 'COMMIT_REJECTED expected');
      check((await h.store.loadLatest()) === null, 'rejected first save leaves the store empty');
    }
  }, {
    name: 'append history: commands and events accumulate in order and the chain verifies',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      for (var n = 1; n <= 3; n++) await h.store.saveCommit(advance(kernel, n, n));
      var all = await h.store.loadHistorySince(0);
      check(all.commands.length === 3 && all.events.length === 3, 'three commands and events stored');
      same(all.events, kernel.events, 'events equal the kernel audit trail');
      var chain = (0, _audit.verifyEventChain)(all.events);
      check(chain.ok && chain.headHash === kernel.chainHead, 'stored chain verifies to the kernel head');
      var tail = await h.store.loadHistorySince(2);
      check(tail.commands.length === 1 && tail.events.length === 1, 'history since revision 2 has one entry');
      check(tail.commands[0]?.resultRevision === 3, 'tail command produced revision 3');
      var none = await h.store.loadHistorySince(3);
      check(none.commands.length === 0 && none.events.length === 0, 'nothing after the latest revision');
    }
  }, {
    name: 'loadLatest follows the newest commit',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      var c1 = advance(kernel, 1, 2);
      await h.store.saveCommit(c1);
      same(await h.store.loadLatest(), c1.snapshot, 'latest is the second snapshot');
    }
  }, {
    name: 'transaction visibility: a failed save changes nothing and can be retried',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      var g = genesisCommit(kernel);
      await h.store.saveCommit(g);
      var c1 = advance(kernel, 1, 2);
      h.failNextCommit();
      var err = await rejection(() => h.store.saveCommit(c1), 'faulted save');
      check(err instanceof _persistence.PersistenceError && err.code === 'WRITE_FAILED', 'WRITE_FAILED expected');
      same(await h.store.loadLatest(), g.snapshot, 'previous snapshot is still the active one');
      same(await h.store.loadHistorySince(0), {
        commands: [],
        events: []
      }, 'no partial history visible');
      same((await h.store.listVerifiedSnapshots()).map(s => s.revision), [0], 'no extra snapshot visible');
      await h.store.saveCommit(c1);
      same(await h.store.loadLatest(), c1.snapshot, 'retry succeeds');
      check((await h.store.loadHistorySince(0)).events.length === 1, 'history written exactly once');
    }
  }, {
    name: 'rejects a commit whose revision does not advance, with nothing changed',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      var c1 = advance(kernel, 1);
      await h.store.saveCommit(c1);
      var err = await rejection(() => h.store.saveCommit(c1), 'replayed commit');
      check(err instanceof _persistence.PersistenceError && err.code === 'COMMIT_REJECTED', 'COMMIT_REJECTED expected');
      check((await h.store.loadHistorySince(0)).events.length === 1, 'history unchanged');
    }
  }, {
    name: 'rejects a commit that skips history (event gap)',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      advance(kernel, 1); // never saved
      var c2 = advance(kernel, 2);
      var err = await rejection(() => h.store.saveCommit(c2), 'gapped commit');
      check(err instanceof _persistence.PersistenceError && err.code === 'COMMIT_REJECTED', 'COMMIT_REJECTED expected');
      check((await h.store.loadLatest())?.revision === 0, 'still at genesis');
    }
  }, {
    name: 'rejects a snapshot that does not match the supplied events',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      var c1 = advance(kernel, 1);
      var forged = {
        ...c1,
        events: []
      };
      var err = await rejection(() => h.store.saveCommit(forged), 'events withheld');
      check(err instanceof _persistence.PersistenceError && err.code === 'COMMIT_REJECTED', 'COMMIT_REJECTED expected');
      same((await h.store.listVerifiedSnapshots()).map(s => s.revision), [0], 'nothing stored');
    }
  }, {
    name: 'rejects a tampered snapshot (content hash mismatch)',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      var c1 = advance(kernel, 1);
      var tampered = {
        ...c1,
        snapshot: {
          ...c1.snapshot,
          world: {
            ...c1.snapshot.world,
            simDate: '2030-01-01'
          }
        }
      };
      var err = await rejection(() => h.store.saveCommit(tampered), 'tampered snapshot');
      check(err instanceof _persistence.PersistenceError && err.code === 'COMMIT_REJECTED', 'COMMIT_REJECTED expected');
    }
  }, {
    name: 'rejects a future schema version on save and stores nothing',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      var g = genesisCommit(kernel);
      await h.store.saveCommit(g);
      var c1 = advance(kernel, 1);
      var future = {
        ...c1,
        snapshot: {
          ...c1.snapshot,
          schemaVersion: _provenance.SCHEMA_VERSION + 1
        }
      };
      var err = await rejection(() => h.store.saveCommit(future), 'future schema');
      check(err instanceof _provenance.UnsupportedSchemaVersionError, 'UnsupportedSchemaVersionError expected');
      same(await h.store.loadLatest(), g.snapshot, 'active snapshot unchanged');
      check((await h.store.loadHistorySince(0)).events.length === 0, 'no history written');
    }
  }, {
    name: 'rejects a command id that was already committed',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      var c1 = advance(kernel, 1);
      await h.store.saveCommit(c1);
      var c2 = advance(kernel, 2);
      var dup = {
        ...c2,
        commands: [{
          ...c2.commands[0],
          envelope: {
            ...c2.commands[0].envelope,
            commandId: (0, _ids.commandId)('cmd-1')
          }
        }]
      };
      var err = await rejection(() => h.store.saveCommit(dup), 'duplicate command id');
      check(err instanceof _persistence.PersistenceError && err.code === 'COMMIT_REJECTED', 'COMMIT_REJECTED expected');
    }
  }, {
    name: 'previous snapshot retention: older verified snapshots stay available, newest first',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      for (var n = 1; n <= 2; n++) await h.store.saveCommit(advance(kernel, n));
      var list = await h.store.listVerifiedSnapshots();
      same(list.map(s => s.revision), [2, 1, 0], 'newest first, previous snapshots retained');
      same(list[1], list[1], 'snapshots are plain data');
    }
  }, {
    name: 'retention keeps the genesis snapshot plus the newest few',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      var total = _persistence.SNAPSHOT_RETENTION_NEWEST + 4;
      for (var n = 1; n <= total; n++) await h.store.saveCommit(advance(kernel, n));
      var revisions = (await h.store.listVerifiedSnapshots()).map(s => s.revision);
      var expected = [];
      for (var r = total; r > total - _persistence.SNAPSHOT_RETENTION_NEWEST; r--) expected.push(r);
      expected.push(0);
      same(revisions, expected, 'genesis + newest retained snapshots');
      check((await h.store.loadHistorySince(0)).events.length === total, 'full history is never pruned');
    }
  }, {
    name: 'returned data never aliases store state',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      await h.store.saveCommit(advance(kernel, 1));
      var a = await h.store.loadLatest();
      var b = await h.store.loadLatest();
      check(a !== null && b !== null, 'snapshot present');
      check(a !== b, 'each load returns a fresh object');
      check(Object.isFrozen(a), 'loaded snapshot is frozen');
      same(a, b, 'loads are equal');
    }
  }, {
    name: 'round trip: a career resumed from the stored snapshot continues identically',
    async run() {
      var h = await open(factory);
      var {
        kernel,
        ruleset
      } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      for (var n = 1; n <= 3; n++) await h.store.saveCommit(advance(kernel, n, n));
      var snap = await h.store.loadLatest();
      check(snap !== null, 'snapshot present');
      if (snap === null) return;
      var resumed = _kernel.WorldKernel.resume({
        world: snap.world,
        ruleset,
        chainHead: snap.chainHead,
        eventCount: snap.eventCount,
        knownCommandIds: snap.knownCommandIds
      });
      check(resumed.execute(envelope(2, 1, 3)).ok === false, 'duplicate stays rejected after reload');
      kernel.execute(envelope(9, 2, 3));
      resumed.execute(envelope(9, 2, 3));
      check((0, _world.fingerprintWorld)(resumed.world) === (0, _world.fingerprintWorld)(kernel.world), 'identical world after reload');
      check(resumed.chainHead === kernel.chainHead, 'identical audit head after reload');
    }
  }, {
    name: 'recovery log is append-only and reports are returned as written',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      var r1 = {
        action: 'FELL_BACK_TO_PREVIOUS_SNAPSHOT',
        previousActiveRevision: 1,
        restoredRevision: 0,
        reasons: ['contentHash does not match snapshot content']
      };
      var r2 = {
        action: 'NO_VERIFIED_SNAPSHOT',
        previousActiveRevision: null,
        restoredRevision: null,
        reasons: ['nothing verifies']
      };
      await h.store.markRecovery(r1);
      await h.store.markRecovery(r2);
      same(await h.store.loadRecoveryLog(), [r1, r2], 'reports kept in order');
      same((await h.store.loadLatest())?.revision, 0, 'a log-only recovery does not change the active snapshot');
    }
  }, {
    name: 'markRecovery installs a repaired snapshot only if it matches stored history',
    async run() {
      var h = await open(factory);
      var {
        kernel
      } = newCareer();
      await h.store.saveCommit(genesisCommit(kernel));
      var stale = genesisCommit(kernel).snapshot; // wrong tail for a one-event history
      var c1 = advance(kernel, 1);
      await h.store.saveCommit(c1);
      var report = {
        action: 'REPAIRED_LATEST_FROM_REPLAY',
        previousActiveRevision: 1,
        restoredRevision: 1,
        reasons: ['test']
      };
      var err = await rejection(() => h.store.markRecovery(report, stale), 'inconsistent repair');
      check(err instanceof _persistence.PersistenceError && err.code === 'COMMIT_REJECTED', 'COMMIT_REJECTED expected');
      same((await h.store.loadRecoveryLog()).length, 0, 'rejected repair is not logged');
      await h.store.markRecovery(report, c1.snapshot);
      same(await h.store.loadLatest(), c1.snapshot, 'repaired snapshot active');
      same((await h.store.loadRecoveryLog()).length, 1, 'repair logged');
    }
  }];
  /** Runs every case without a test framework (used by the on-device diagnostics harness). */
  var runContractCases = async cases => {
    var results = [];
    for (var c of cases) {
      try {
        await c.run();
        results.push({
          name: c.name,
          passed: true
        });
      } catch (error) {
        results.push({
          name: c.name,
          passed: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return results;
  };
  /** Deterministic synthetic career used by the persistence and recovery contracts. */
  var createContractCareer = () => {
    var {
      kernel,
      ruleset
    } = newCareer();
    var n = 0;
    return {
      kernel,
      ruleset,
      genesis: () => genesisCommit(kernel),
      step: (days = 1) => advance(kernel, ++n, days)
    };
  };
},19,[4,15,2,16,17,10,11,12,14]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "recoveryCheck", {
    enumerable: true,
    get: function () {
      return recoveryCheck;
    }
  });
  Object.defineProperty(exports, "expectRejection", {
    enumerable: true,
    get: function () {
      return expectRejection;
    }
  });
  Object.defineProperty(exports, "seedCareer", {
    enumerable: true,
    get: function () {
      return seedCareer;
    }
  });
  Object.defineProperty(exports, "recoveryContractCases", {
    enumerable: true,
    get: function () {
      return recoveryContractCases;
    }
  });
  Object.defineProperty(exports, "repairContractCases", {
    enumerable: true,
    get: function () {
      return repairContractCases;
    }
  });
  var _audit = require(_dependencyMap[0]);
  var _world = require(_dependencyMap[1]);
  var _persistenceContract = require(_dependencyMap[2]);
  var _provenance = require(_dependencyMap[3]);
  var _persistence = require(_dependencyMap[4]);
  var _careerIntegrity = require(_dependencyMap[5]);
  var _recovery = require(_dependencyMap[6]);
  var _ruleset = require(_dependencyMap[7]);
  /**
   * Framework-free contract for loading, corruption detection and recovery. Every adapter
   * supplies the three corruption seams; the cases are identical for memory and SQLite and
   * run unchanged in the Expo/Hermes runtime.
   */

  class RecoveryContractFailure extends Error {
    constructor(message) {
      super(`Recovery contract violated: ${message}`);
      this.name = 'RecoveryContractFailure';
    }
  }
  var recoveryCheck = (condition, message) => {
    if (!condition) throw new RecoveryContractFailure(message);
  };
  var expectRejection = async (fn, message) => {
    try {
      await fn();
    } catch (error) {
      return error;
    }
    throw new RecoveryContractFailure(`${message} (expected a rejection, got success)`);
  };

  /** Store with a genesis save plus four committed days (revisions 0..4). */
  var seedCareer = async (h, _p) => {
    var commits = _p === undefined ? 4 : _p;
    await h.store.initialize();
    var career = (0, _persistenceContract.createContractCareer)();
    await h.store.saveCommit(career.genesis());
    for (var i = 1; i <= commits; i++) await h.store.saveCommit(career.step(i));
    return career;
  };
  var recoveryContractCases = factory => [{
    name: 'an empty store loads as empty',
    async run() {
      var h = await factory();
      await h.store.initialize();
      var ruleset = (0, _persistenceContract.createContractCareer)().ruleset;
      recoveryCheck((await (0, _recovery.loadCareer)(h.store, {
        ruleset
      })).status === 'empty', 'empty store -> empty');
    }
  }, {
    name: 'a healthy career loads, is not reported as recovered, and keeps executing identically',
    async run() {
      var h = await factory();
      var career = await seedCareer(h);
      var out = await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset
      });
      recoveryCheck(out.status === 'loaded', `expected loaded, got ${out.status}`);
      if (out.status !== 'loaded') return;
      recoveryCheck((0, _world.fingerprintWorld)(out.kernel.world) === (0, _world.fingerprintWorld)(career.kernel.world), 'loaded world fingerprint equals live world');
      recoveryCheck(out.kernel.chainHead === career.kernel.chainHead, 'loaded audit head equals live head');
      var next = career.step(2);
      var res = out.kernel.execute(next.commands[0].envelope);
      recoveryCheck(res.ok, 'loaded kernel accepts the next command');
      recoveryCheck((0, _world.fingerprintWorld)(out.kernel.world) === (0, _world.fingerprintWorld)(career.kernel.world), 'loaded kernel stays in lock-step with the live one');
      recoveryCheck((await h.store.loadRecoveryLog()).length === 0, 'a healthy load logs no recovery');
    }
  }, {
    name: 'a corrupt newest snapshot is detected and the newest older verified snapshot is used, explicitly',
    async run() {
      var h = await factory();
      var career = await seedCareer(h);
      await h.tamperSnapshot(4, 'hash');
      var out = await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset
      });
      recoveryCheck(out.status === 'degraded', `expected degraded, got ${out.status}`);
      if (out.status !== 'degraded') return;
      recoveryCheck(out.snapshot.revision === 3, 'fell back to revision 3');
      recoveryCheck(out.report.action === 'FELL_BACK_TO_PREVIOUS_SNAPSHOT', 'report names the fallback');
      recoveryCheck(out.report.previousActiveRevision === 4, 'report names the damaged revision');
      recoveryCheck(out.report.restoredRevision === 3, 'report names the restored revision');
      recoveryCheck(out.report.reasons.length > 0, 'report explains why');
      var log = await h.store.loadRecoveryLog();
      recoveryCheck(log.length === 1, 'the recovery is recorded durably');
      var stillBad = await h.store.loadLatest();
      recoveryCheck(!(0, _persistence.verifySnapshot)(stillBad).ok, 'corruption is not silently erased');
    }
  }, {
    name: 'an unreadable newest snapshot also falls back explicitly',
    async run() {
      var h = await factory();
      var career = await seedCareer(h);
      await h.tamperSnapshot(4, 'junk');
      var out = await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset
      });
      recoveryCheck(out.status === 'degraded', `expected degraded, got ${out.status}`);
      if (out.status === 'degraded') recoveryCheck(out.snapshot.revision === 3, 'fell back to revision 3');
    }
  }, {
    name: 'repeating a degraded load does not flood the recovery log',
    async run() {
      var h = await factory();
      var career = await seedCareer(h);
      await h.tamperSnapshot(4, 'hash');
      await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset
      });
      await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset
      });
      recoveryCheck((await h.store.loadRecoveryLog()).length === 1, 'identical recovery logged once');
    }
  }, {
    name: 'a future-schema active snapshot fails closed (no fallback to older data)',
    async run() {
      var h = await factory();
      var career = await seedCareer(h);
      await h.tamperSnapshot(4, 'future');
      var err = await expectRejection(() => (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset
      }), 'future schema');
      recoveryCheck(err instanceof _provenance.UnsupportedSchemaVersionError, 'UnsupportedSchemaVersionError expected');
      recoveryCheck((await h.store.loadRecoveryLog()).length === 0, 'nothing is "recovered" from a future build');
    }
  }, {
    name: 'missing history is detected: the load degrades to a snapshot that history still supports',
    async run() {
      var h = await factory();
      var career = await seedCareer(h);
      await h.truncateHistory(1);
      var out = await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset
      });
      recoveryCheck(out.status === 'degraded', `expected degraded, got ${out.status}`);
      if (out.status !== 'degraded') return;
      recoveryCheck(out.snapshot.revision === 3, 'fell back to the last snapshot the history supports');
      recoveryCheck(out.report.reasons.some(r => r.includes('history')), 'report mentions the missing history');
    }
  }, {
    name: 'a tampered event breaks the chain and limits fallback to the verified prefix',
    async run() {
      var h = await factory();
      var career = await seedCareer(h);
      await h.tamperEvent(2);
      var out = await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset
      });
      recoveryCheck(out.status === 'degraded', `expected degraded, got ${out.status}`);
      if (out.status !== 'degraded') return;
      recoveryCheck(out.snapshot.revision === 2, 'fell back to the snapshot inside the verified prefix');
      var events = (await h.store.loadHistorySince(0)).events;
      recoveryCheck(!(0, _audit.verifyEventChain)(events).ok, 'the tampered chain really fails verification');
    }
  }, {
    name: 'when no snapshot can be trusted the load fails explicitly',
    async run() {
      var h = await factory();
      var career = await seedCareer(h, 2);
      for (var r of [0, 1, 2]) await h.tamperSnapshot(r, 'hash');
      var out = await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset
      });
      recoveryCheck(out.status === 'failed', `expected failed, got ${out.status}`);
      if (out.status === 'failed') {
        recoveryCheck(out.report.action === 'NO_VERIFIED_SNAPSHOT', 'report says nothing verifies');
      }
    }
  }, {
    name: 'a ruleset that does not match the career is refused, not "recovered"',
    async run() {
      var h = await factory();
      var career = await seedCareer(h, 1);
      var other = (0, _ruleset.sealRuleset)({
        schemaVersion: _provenance.SCHEMA_VERSION,
        rulesetId: 'some-other-ruleset',
        rulesetVersion: 1,
        displayName: 'Other',
        provenance: career.ruleset.provenance,
        rules: {
          maxAdvanceDaysPerCommand: 30
        }
      });
      var err = await expectRejection(() => (0, _recovery.loadCareer)(h.store, {
        ruleset: other
      }), 'ruleset mismatch');
      recoveryCheck(err instanceof _careerIntegrity.CareerLoadError && err.code === 'RULESET_MISMATCH', 'RULESET_MISMATCH expected');
      recoveryCheck((await h.store.loadRecoveryLog()).length === 0, 'no recovery logged');
    }
  }];

  /** Repair behaviour: rebuild the latest snapshot from immutable history, or refuse. */
  var repairContractCases = factory => [{
    name: 'repair: a corrupt newest snapshot is rebuilt from history exactly, logged, and then loads cleanly',
    async run() {
      var h = await factory();
      var career = await seedCareer(h);
      var original = await h.store.loadLatest();
      await h.tamperSnapshot(4, 'hash');
      var out = await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset,
        repair: true
      });
      recoveryCheck(out.status === 'recovered', `expected recovered, got ${out.status}`);
      if (out.status !== 'recovered') return;
      recoveryCheck(out.report.action === 'REPAIRED_LATEST_FROM_REPLAY', 'report names the repair');
      recoveryCheck(out.snapshot.contentHash === original?.contentHash, 'repaired snapshot equals the original exactly');
      recoveryCheck((0, _world.fingerprintWorld)(out.kernel.world) === (0, _world.fingerprintWorld)(career.kernel.world), 'repaired world fingerprint equals live world');
      recoveryCheck(out.kernel.chainHead === career.kernel.chainHead, 'repaired audit head equals live head');
      var next = career.step(3);
      recoveryCheck(out.kernel.execute(next.commands[0].envelope).ok, 'repaired career keeps executing');
      var log = await h.store.loadRecoveryLog();
      recoveryCheck(log.length === 1 && log[0]?.action === 'REPAIRED_LATEST_FROM_REPLAY', 'repair logged once');
    }
  }, {
    name: 'repair: an unreadable newest snapshot is rebuilt too',
    async run() {
      var h = await factory();
      var career = await seedCareer(h);
      var original = await h.store.loadLatest();
      await h.tamperSnapshot(4, 'junk');
      var out = await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset,
        repair: true
      });
      recoveryCheck(out.status === 'recovered', `expected recovered, got ${out.status}`);
      if (out.status === 'recovered') {
        recoveryCheck(out.snapshot.contentHash === original?.contentHash, 'repaired snapshot equals the original');
      }
    }
  }, {
    name: 'repair: works from genesis when every other snapshot is damaged',
    async run() {
      var h = await factory();
      var career = await seedCareer(h);
      var original = await h.store.loadLatest();
      for (var r of [1, 2, 3, 4]) await h.tamperSnapshot(r, 'hash');
      var out = await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset,
        repair: true
      });
      recoveryCheck(out.status === 'recovered', `expected recovered, got ${out.status}`);
      if (out.status === 'recovered') {
        recoveryCheck(out.snapshot.contentHash === original?.contentHash, 'rebuilt from genesis history');
      }
    }
  }, {
    name: 'repair: a repaired career loads as healthy afterwards without new recovery entries',
    async run() {
      var h = await factory();
      var career = await seedCareer(h);
      await h.tamperSnapshot(4, 'hash');
      await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset,
        repair: true
      });
      var again = await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset
      });
      recoveryCheck(again.status === 'loaded', `expected loaded, got ${again.status}`);
      recoveryCheck((await h.store.loadRecoveryLog()).length === 1, 'no further recovery entries');
    }
  }, {
    name: 'repair: refused when the event chain is tampered (no fabricated snapshot)',
    async run() {
      var h = await factory();
      var career = await seedCareer(h);
      await h.tamperEvent(2);
      await h.tamperSnapshot(4, 'hash');
      var out = await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset,
        repair: true
      });
      recoveryCheck(out.status === 'degraded', `expected degraded, got ${out.status}`);
      var log = await h.store.loadRecoveryLog();
      recoveryCheck(log.every(r => r.action !== 'REPAIRED_LATEST_FROM_REPLAY'), 'no repair was recorded');
      recoveryCheck(!(0, _persistence.verifySnapshot)(await h.store.loadLatest()).ok, 'the damaged snapshot was left as it was');
    }
  }, {
    name: 'repair: refused when history is shorter than the active snapshot (no silent data loss)',
    async run() {
      var h = await factory();
      var career = await seedCareer(h);
      await h.truncateHistory(1);
      var out = await (0, _recovery.loadCareer)(h.store, {
        ruleset: career.ruleset,
        repair: true
      });
      recoveryCheck(out.status === 'degraded', `expected degraded, got ${out.status}`);
      var log = await h.store.loadRecoveryLog();
      recoveryCheck(log.every(r => r.action !== 'REPAIRED_LATEST_FROM_REPLAY'), 'no repair was recorded');
    }
  }];
},20,[15,14,19,10,17,21,22,11]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "CareerLoadError", {
    enumerable: true,
    get: function () {
      return CareerLoadError;
    }
  });
  Object.defineProperty(exports, "requireMatchingRefs", {
    enumerable: true,
    get: function () {
      return requireMatchingRefs;
    }
  });
  Object.defineProperty(exports, "historySupports", {
    enumerable: true,
    get: function () {
      return historySupports;
    }
  });
  var _audit = require(_dependencyMap[0]);
  var _canonical = require(_dependencyMap[1]);
  var _ruleset = require(_dependencyMap[2]);
  var _seed = require(_dependencyMap[3]);
  /** The stored career is intact but belongs to a different ruleset/seed than the caller supplied. */
  class CareerLoadError extends Error {
    constructor(code, message) {
      super(`${code}: ${message}`);
      this.name = 'CareerLoadError';
      this.code = code;
    }
  }
  /** Check a snapshot belongs to the supplied ruleset (and seed, when given). Throws if not. */
  var requireMatchingRefs = (snapshot, options) => {
    var want = (0, _ruleset.rulesetRefOf)(options.ruleset);
    var have = snapshot.world.ruleset;
    if (have.rulesetId !== want.rulesetId || have.rulesetVersion !== want.rulesetVersion || have.contentHash !== want.contentHash) {
      throw new CareerLoadError('RULESET_MISMATCH', `career uses ${have.rulesetId} v${have.rulesetVersion}, caller supplied ${want.rulesetId} v${want.rulesetVersion}`);
    }
    if (options.seed !== undefined) {
      var wantSeed = (0, _seed.seedRefOf)(options.seed);
      if ((0, _canonical.canonicalString)(snapshot.world.seed) !== (0, _canonical.canonicalString)(wantSeed)) {
        throw new CareerLoadError('SEED_MISMATCH', 'career descends from a different world seed');
      }
    }
  };

  /** Does the verified event prefix support `snapshot` (its count and audit head)? */
  var historySupports = (snapshot, events, verifiedPrefix) => {
    if (snapshot.eventCount > verifiedPrefix) return false;
    if (snapshot.eventCount === 0) return snapshot.chainHead === _audit.GENESIS_HASH;
    return events[snapshot.eventCount - 1]?.hash === snapshot.chainHead;
  };
},21,[15,4,11,12]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "logRecovery", {
    enumerable: true,
    get: function () {
      return logRecovery;
    }
  });
  Object.defineProperty(exports, "loadCareer", {
    enumerable: true,
    get: function () {
      return loadCareer;
    }
  });
  var _audit = require(_dependencyMap[0]);
  var _canonical = require(_dependencyMap[1]);
  var _careerIntegrity = require(_dependencyMap[2]);
  var _kernel = require(_dependencyMap[3]);
  var _persistence = require(_dependencyMap[4]);
  var _replay = require(_dependencyMap[5]);
  var sameReport = (a, b) => (0, _canonical.canonicalString)(a) === (0, _canonical.canonicalString)(b);

  /** Record a recovery once: an identical report as the newest log entry is not repeated. */
  var logRecovery = async (store, report) => {
    var log = await store.loadRecoveryLog();
    var last = log[log.length - 1];
    if (last !== undefined && sameReport(last, report)) return;
    await store.markRecovery(report);
  };

  /**
   * Load a career defensively. It verifies the schema (a future schema throws and is never
   * "recovered"), snapshot hash, ruleset/seed references and the audit-chain head, and it
   * never treats damaged data as valid: any problem produces an explicit RecoveryReport.
   */
  var loadCareer = async (store, options) => {
    var active = null;
    var unreadable = null;
    try {
      active = await store.loadLatest();
    } catch (error) {
      if (error instanceof _persistence.PersistenceError && error.code === 'CORRUPT_STORE') unreadable = error.message;else throw error; // includes UnsupportedSchemaVersionError: fail closed
    }
    if (active === null && unreadable === null) return {
      status: 'empty'
    };
    var history = await store.loadHistorySince(0);
    var events = history.events;
    var chain = (0, _audit.verifyEventChain)(events);
    var verifiedPrefix = chain.ok ? events.length : chain.index;
    var reasons = [];
    if (unreadable !== null) reasons.push(`active snapshot unreadable: ${unreadable}`);
    if (active !== null) {
      var verdict = (0, _persistence.verifySnapshot)(active);
      if (!verdict.ok) {
        reasons.push(...verdict.reasons.map(r => `active snapshot: ${r}`));
      } else {
        (0, _careerIntegrity.requireMatchingRefs)(active, options);
      }
      if (!chain.ok) {
        reasons.push(`event history failed verification at event ${chain.index} (${chain.reason})`);
      } else if (events.length < active.eventCount) {
        reasons.push(`event history ends at event ${events.length} but the active snapshot expects ${active.eventCount}`);
      } else if (events.length > active.eventCount) {
        reasons.push(`event history (${events.length} events) is ahead of the active snapshot (${active.eventCount})`);
      } else if (chain.headHash !== active.chainHead) {
        reasons.push('active snapshot chainHead does not match the stored event history');
      }
    }
    if (reasons.length === 0 && active !== null) {
      var kernel = _kernel.WorldKernel.resume({
        world: active.world,
        ruleset: options.ruleset,
        chainHead: active.chainHead,
        eventCount: active.eventCount,
        knownCommandIds: active.knownCommandIds
      });
      return {
        status: 'loaded',
        kernel,
        snapshot: active
      };
    }
    var previousActiveRevision = active?.revision ?? null;
    if (options.repair === true) {
      var repair = await (0, _replay.repairLatestFromHistory)(store, {
        ...options,
        reasons
      });
      if (repair.status === 'repaired') {
        return {
          status: 'recovered',
          kernel: repair.kernel,
          snapshot: repair.snapshot,
          report: repair.report
        };
      }
      reasons.push(...repair.reasons.map(r => `repair refused: ${r}`));
    }

    // Not trustworthy as-is: pick the newest verified snapshot that history still supports.
    for (var candidate of await store.listVerifiedSnapshots()) {
      if (!(0, _careerIntegrity.historySupports)(candidate, events, verifiedPrefix)) continue;
      (0, _careerIntegrity.requireMatchingRefs)(candidate, options);
      var _report = {
        action: 'FELL_BACK_TO_PREVIOUS_SNAPSHOT',
        previousActiveRevision,
        restoredRevision: candidate.revision,
        reasons
      };
      await logRecovery(store, _report);
      return {
        status: 'degraded',
        snapshot: candidate,
        report: _report
      };
    }
    var report = {
      action: 'NO_VERIFIED_SNAPSHOT',
      previousActiveRevision,
      restoredRevision: null,
      reasons
    };
    await logRecovery(store, report);
    return {
      status: 'failed',
      report
    };
  };
},22,[15,4,21,16,17,23]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "ReplayError", {
    enumerable: true,
    get: function () {
      return ReplayError;
    }
  });
  Object.defineProperty(exports, "replayFrom", {
    enumerable: true,
    get: function () {
      return replayFrom;
    }
  });
  Object.defineProperty(exports, "verifyCareerReplay", {
    enumerable: true,
    get: function () {
      return verifyCareerReplay;
    }
  });
  Object.defineProperty(exports, "repairLatestFromHistory", {
    enumerable: true,
    get: function () {
      return repairLatestFromHistory;
    }
  });
  var _audit = require(_dependencyMap[0]);
  var _canonical = require(_dependencyMap[1]);
  var _careerIntegrity = require(_dependencyMap[2]);
  var _kernel = require(_dependencyMap[3]);
  var _persistence = require(_dependencyMap[4]);
  var _world = require(_dependencyMap[5]);
  class ReplayError extends Error {
    constructor(code, message) {
      super(`${code}: ${message}`);
      this.name = 'ReplayError';
      this.code = code;
    }
  }
  /**
   * Re-execute stored commands from `snapshot` through the exact production WorldKernel.
   * There is no alternate mutation path: a command the kernel rejects, or events that differ
   * from `expectedEvents`, are errors rather than being skipped or patched.
   */
  var replayFrom = (snapshot, ruleset, commands, expectedEvents) => {
    var kernel = _kernel.WorldKernel.resume({
      world: snapshot.world,
      ruleset,
      chainHead: snapshot.chainHead,
      eventCount: snapshot.eventCount,
      knownCommandIds: snapshot.knownCommandIds
    });
    var produced = [];
    for (var record of commands) {
      var result = kernel.execute(record.envelope);
      if (!result.ok) {
        throw new ReplayError('COMMAND_REJECTED', `${record.envelope.commandId} was rejected during replay (${result.rejection.code}: ${result.rejection.message})`);
      }
      if (Number(result.world.revision) !== record.resultRevision) {
        throw new ReplayError('REVISION_MISMATCH', `${record.envelope.commandId} produced revision ${result.world.revision}, history says ${record.resultRevision}`);
      }
      produced.push(...result.events);
    }
    if (expectedEvents !== undefined) {
      if (produced.length !== expectedEvents.length) {
        throw new ReplayError('EVENT_MISMATCH', `replay produced ${produced.length} events, history has ${expectedEvents.length}`);
      }
      for (var i = 0; i < produced.length; i++) {
        if ((0, _canonical.canonicalString)(produced[i]) !== (0, _canonical.canonicalString)(expectedEvents[i])) {
          throw new ReplayError('EVENT_MISMATCH', `replayed event ${i} differs from stored event ${i}`);
        }
      }
    }
    return {
      kernel,
      snapshot: (0, _persistence.sealSnapshot)({
        world: kernel.world,
        chainHead: kernel.chainHead,
        eventCount: kernel.eventCount,
        knownCommandIds: kernel.knownCommandIds
      }),
      events: produced
    };
  };
  var activeOrNull = async store => {
    try {
      return await store.loadLatest();
    } catch (error) {
      if (error instanceof _persistence.PersistenceError && error.code === 'CORRUPT_STORE') return null;
      throw error;
    }
  };

  /**
   * Replay the ENTIRE stored history from the verified genesis snapshot and compare the final
   * world fingerprint and audit-chain head with what is stored. Read-only.
   */
  var verifyCareerReplay = async (store, ruleset) => {
    var reasons = [];
    var genesis = (await store.listVerifiedSnapshots()).find(s => s.revision === 0);
    if (genesis === undefined) return {
      ok: false,
      reasons: ['no verified genesis snapshot to replay from']
    };
    var history = await store.loadHistorySince(0);
    var chain = (0, _audit.verifyEventChain)(history.events);
    if (!chain.ok) reasons.push(`event history failed verification at event ${chain.index} (${chain.reason})`);
    var result;
    try {
      result = replayFrom(genesis, ruleset, history.commands, history.events);
    } catch (error) {
      if (error instanceof Error && error.name === 'ReplayError') {
        return {
          ok: false,
          reasons: [...reasons, error.message]
        };
      }
      throw error;
    }
    var fingerprint = (0, _world.fingerprintWorld)(result.kernel.world);
    var chainHead = result.kernel.chainHead;
    var active = await activeOrNull(store);
    if (active === null) {
      reasons.push('no readable active snapshot to compare against');
    } else {
      var verdict = (0, _persistence.verifySnapshot)(active);
      if (!verdict.ok) reasons.push(...verdict.reasons.map(r => `active snapshot: ${r}`));
      if (active.worldFingerprint !== fingerprint) reasons.push('active snapshot fingerprint differs from replayed history');
      if (active.chainHead !== chainHead) reasons.push('active snapshot chainHead differs from replayed history');
      if (active.eventCount !== history.events.length) {
        reasons.push(`active snapshot expects ${active.eventCount} events, history has ${history.events.length}`);
      }
    }
    return {
      ok: reasons.length === 0,
      reasons,
      fingerprint,
      chainHead
    };
  };
  /**
   * Rebuild the latest snapshot by replaying immutable history from the newest verified
   * snapshot that history supports. It writes ONLY when the whole event chain verifies, the
   * replay matches stored events exactly, and it would not silently discard committed work.
   */
  var repairLatestFromHistory = async (store, options) => {
    var refuse = (...reasons) => ({
      status: 'refused',
      reasons
    });
    var history = await store.loadHistorySince(0);
    var events = history.events;
    var chain = (0, _audit.verifyEventChain)(events);
    if (!chain.ok) {
      return refuse(`event history failed verification at event ${chain.index} (${chain.reason})`);
    }
    var active = await activeOrNull(store);
    if (active !== null && (0, _persistence.verifySnapshot)(active).ok) {
      if (active.eventCount > events.length) {
        return refuse(`history ends at event ${events.length} but the active snapshot expects ${active.eventCount}; repair would discard committed work`);
      }
      if (active.eventCount === events.length && active.chainHead === chain.headHash) {
        return refuse('active snapshot already matches history; nothing to repair');
      }
    }
    var base = (await store.listVerifiedSnapshots()).find(s => (0, _careerIntegrity.historySupports)(s, events, events.length));
    if (base === undefined) return refuse('no verified snapshot is supported by the stored history');
    (0, _careerIntegrity.requireMatchingRefs)(base, options);
    var tail = await store.loadHistorySince(base.revision);
    var result;
    try {
      result = replayFrom(base, options.ruleset, tail.commands, events.slice(base.eventCount));
    } catch (error) {
      if (error instanceof Error && error.name === 'ReplayError') return refuse(error.message);
      throw error;
    }
    var tailHash = events.length === 0 ? _audit.GENESIS_HASH : events[events.length - 1].hash;
    if (result.snapshot.eventCount !== events.length || result.snapshot.chainHead !== tailHash) {
      return refuse('replayed state does not end at the stored history tail');
    }
    var report = {
      action: 'REPAIRED_LATEST_FROM_REPLAY',
      previousActiveRevision: active?.revision ?? null,
      restoredRevision: result.snapshot.revision,
      reasons: options.reasons ?? ['repair requested']
    };
    await store.markRecovery(report, result.snapshot);
    return {
      status: 'repaired',
      kernel: result.kernel,
      snapshot: result.snapshot,
      report
    };
  };
},23,[15,4,21,16,17,14]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "SYNTHETIC_RULESET", {
    enumerable: true,
    get: function () {
      return SYNTHETIC_RULESET;
    }
  });
  Object.defineProperty(exports, "SYNTHETIC_SEED", {
    enumerable: true,
    get: function () {
      return SYNTHETIC_SEED;
    }
  });
  var _provenance = require(_dependencyMap[0]);
  var _ruleset = require(_dependencyMap[1]);
  var _seed = require(_dependencyMap[2]);
  /**
   * The synthetic Package A ruleset and seed, built with the production sealing code.
   * Node (headless), tests and the Expo/Hermes app all import THESE values, so every runtime
   * starts from byte-identical inputs. Contains no real league data.
   * The committed JSON in /fixtures is generated from this module and tested against it.
   */
  var provenance = {
    sourceId: 'sport-sim-synthetic-package-a',
    sourceKind: 'synthetic',
    retrievedAt: '2026-10-16T00:00:00Z',
    effectiveAsOf: '2026-10-16',
    validationStatus: 'synthetic',
    note: 'Synthetic Package A fixture. Contains no real league data.'
  };
  var SYNTHETIC_RULESET = (0, _ruleset.sealRuleset)({
    schemaVersion: _provenance.SCHEMA_VERSION,
    rulesetId: 'synthetic-minimal',
    rulesetVersion: 1,
    displayName: 'Synthetic Minimal Ruleset (Package A)',
    provenance: [provenance],
    rules: {
      maxAdvanceDaysPerCommand: 30
    }
  });
  var SYNTHETIC_SEED = (0, _seed.sealSeed)({
    schemaVersion: _provenance.SCHEMA_VERSION,
    seedId: 'synthetic-empty',
    seedVersion: 1,
    ruleset: (0, _ruleset.rulesetRefOf)(SYNTHETIC_RULESET),
    rngSeed32: 20261016,
    startDate: '2026-10-16',
    provenance: [provenance],
    initialEntities: []
  });
},24,[10,11,12]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "GOLDEN_SCENARIO_ID", {
    enumerable: true,
    get: function () {
      return GOLDEN_SCENARIO_ID;
    }
  });
  Object.defineProperty(exports, "GOLDEN_WORLD_ID", {
    enumerable: true,
    get: function () {
      return GOLDEN_WORLD_ID;
    }
  });
  Object.defineProperty(exports, "GOLDEN_STEPS", {
    enumerable: true,
    get: function () {
      return GOLDEN_STEPS;
    }
  });
  Object.defineProperty(exports, "GoldenScenarioError", {
    enumerable: true,
    get: function () {
      return GoldenScenarioError;
    }
  });
  Object.defineProperty(exports, "runGoldenScenario", {
    enumerable: true,
    get: function () {
      return runGoldenScenario;
    }
  });
  Object.defineProperty(exports, "runGoldenThroughStore", {
    enumerable: true,
    get: function () {
      return runGoldenThroughStore;
    }
  });
  Object.defineProperty(exports, "diffGolden", {
    enumerable: true,
    get: function () {
      return diffGolden;
    }
  });
  var _ids = require(_dependencyMap[0]);
  var _kernel = require(_dependencyMap[1]);
  var _recovery = require(_dependencyMap[2]);
  var _replay = require(_dependencyMap[3]);
  var _persistence = require(_dependencyMap[4]);
  var _syntheticFixtures = require(_dependencyMap[5]);
  var _world = require(_dependencyMap[6]);
  /**
   * The Package A golden scenario. It is defined ONCE, here, in pure sim-core, so Node (the
   * headless runner and Vitest) and the Expo/Hermes app run literally the same code on the
   * same inputs. Matching outputs across runtimes is the cross-runtime determinism proof.
   *
   * It mixes accepted commands with rejected ones (duplicate, stale, invalid, unauthorized)
   * and checks that every rejection leaves the world, the RNG and the audit chain untouched.
   */
  var GOLDEN_SCENARIO_ID = 'package-a-golden-v1';
  var GOLDEN_WORLD_ID = 'world-golden-1';
  var harness = {
    kind: 'test_harness',
    id: (0, _ids.entityId)('golden-harness')
  };
  var cpu = {
    kind: 'cpu_org',
    id: (0, _ids.entityId)('golden-cpu')
  };
  var envelope = (n, days, revision, actor = harness) => ({
    commandId: (0, _ids.commandId)(`cmd-${String(n).padStart(6, '0')}`),
    expectedRevision: (0, _ids.worldRevision)(revision),
    actor,
    command: {
      type: 'AdvanceDays',
      days
    }
  });
  var rev = k => Number(k.world.revision);
  var GOLDEN_STEPS = [{
    label: 'advance-1',
    expect: 'committed',
    build: k => envelope(1, 1, rev(k))
  }, {
    label: 'advance-6',
    expect: 'committed',
    build: k => envelope(2, 6, rev(k))
  }, {
    label: 'duplicate-command',
    expect: 'DUPLICATE_COMMAND',
    build: k => envelope(2, 6, rev(k))
  }, {
    label: 'stale-revision',
    expect: 'STALE_REVISION',
    build: () => envelope(3, 1, 0)
  }, {
    label: 'invalid-days',
    expect: 'INVALID_PAYLOAD',
    build: k => envelope(3, 0, rev(k))
  }, {
    label: 'unauthorized-actor',
    expect: 'UNAUTHORIZED_ACTOR',
    build: k => envelope(3, 1, rev(k), cpu)
  }, {
    label: 'advance-7',
    expect: 'committed',
    build: k => envelope(3, 7, rev(k))
  }];
  class GoldenScenarioError extends Error {
    constructor(message) {
      super(`Golden scenario violated: ${message}`);
      this.name = 'GoldenScenarioError';
    }
  }
  var stateOf = k => ({
    fingerprint: (0, _world.fingerprintWorld)(k.world),
    rngDraws: k.world.rng.draws,
    chainHead: k.chainHead,
    events: k.eventCount
  });

  /** Run the scenario on a fresh kernel. `onCommit` receives each committed commit record. */
  var runGoldenScenario = onCommit => {
    var world = (0, _world.createWorld)(_syntheticFixtures.SYNTHETIC_SEED, _syntheticFixtures.SYNTHETIC_RULESET, {
      newWorldId: () => (0, _ids.worldId)(GOLDEN_WORLD_ID)
    });
    var kernel = _kernel.WorldKernel.fromGenesis(world, _syntheticFixtures.SYNTHETIC_RULESET);
    var steps = [];
    var commandDays = [];
    for (var spec of GOLDEN_STEPS) {
      var env = spec.build(kernel);
      var before = stateOf(kernel);
      var result = kernel.execute(env);
      if (spec.expect === 'committed') {
        if (!result.ok) throw new GoldenScenarioError(`${spec.label} should commit but was rejected: ${result.rejection.code}`);
        commandDays.push(env.command.days);
        onCommit?.({
          snapshot: (0, _persistence.sealSnapshot)({
            world: kernel.world,
            chainHead: kernel.chainHead,
            eventCount: kernel.eventCount,
            knownCommandIds: kernel.knownCommandIds
          }),
          commands: [{
            envelope: env,
            resultRevision: Number(result.world.revision)
          }],
          events: result.events
        });
      } else {
        if (result.ok) throw new GoldenScenarioError(`${spec.label} should be rejected as ${spec.expect} but committed`);
        if (result.rejection.code !== spec.expect) {
          throw new GoldenScenarioError(`${spec.label} rejected as ${result.rejection.code}, expected ${spec.expect}`);
        }
        var after = stateOf(kernel);
        if (after.fingerprint !== before.fingerprint || after.rngDraws !== before.rngDraws || after.chainHead !== before.chainHead) {
          throw new GoldenScenarioError(`${spec.label} changed state or consumed randomness`);
        }
      }
      steps.push({
        label: spec.label,
        outcome: spec.expect,
        revision: Number(kernel.world.revision),
        rngDraws: kernel.world.rng.draws,
        fingerprint: (0, _world.fingerprintWorld)(kernel.world),
        chainHead: kernel.chainHead
      });
    }
    return {
      scenario: GOLDEN_SCENARIO_ID,
      worldId: kernel.world.worldId,
      finalSimDate: kernel.world.simDate,
      revision: Number(kernel.world.revision),
      eventCount: kernel.eventCount,
      rngDraws: kernel.world.rng.draws,
      commandDays,
      fingerprint: (0, _world.fingerprintWorld)(kernel.world),
      eventChainHead: kernel.chainHead,
      steps
    };
  };
  /**
   * Run the golden scenario, persist every commit through `store`, reload the career from the
   * store and replay the stored history. Used to prove storage + reload + replay agree with
   * the kernel inside each runtime.
   */
  var runGoldenThroughStore = async store => {
    var world = (0, _world.createWorld)(_syntheticFixtures.SYNTHETIC_SEED, _syntheticFixtures.SYNTHETIC_RULESET, {
      newWorldId: () => (0, _ids.worldId)(GOLDEN_WORLD_ID)
    });
    var genesisKernel = _kernel.WorldKernel.fromGenesis(world, _syntheticFixtures.SYNTHETIC_RULESET);
    await store.initialize();
    await store.saveCommit({
      snapshot: (0, _persistence.sealSnapshot)({
        world: genesisKernel.world,
        chainHead: genesisKernel.chainHead,
        eventCount: 0,
        knownCommandIds: []
      }),
      commands: [],
      events: []
    });
    var commits = [];
    var result = runGoldenScenario(record => commits.push(record));
    for (var record of commits) await store.saveCommit(record);
    var loaded = await (0, _recovery.loadCareer)(store, {
      ruleset: _syntheticFixtures.SYNTHETIC_RULESET,
      seed: _syntheticFixtures.SYNTHETIC_SEED
    });
    var replay = await (0, _replay.verifyCareerReplay)(store, _syntheticFixtures.SYNTHETIC_RULESET);
    return {
      result,
      loadStatus: loaded.status,
      replayOk: replay.ok,
      reloadedFingerprint: loaded.status === 'loaded' ? (0, _world.fingerprintWorld)(loaded.kernel.world) : null,
      reloadedChainHead: loaded.status === 'loaded' ? loaded.kernel.chainHead : null
    };
  };

  /** Compare a run against recorded expectations; returns human-readable differences. */
  var diffGolden = (actual, expected) => {
    var diffs = [];
    var keys = ['scenario', 'worldId', 'finalSimDate', 'revision', 'eventCount', 'rngDraws', 'fingerprint', 'eventChainHead'];
    for (var k of keys) if (actual[k] !== expected[k]) diffs.push(`${k}: ${String(actual[k])} != ${String(expected[k])}`);
    if (JSON.stringify(actual.commandDays) !== JSON.stringify(expected.commandDays)) diffs.push('commandDays differ');
    if (JSON.stringify(actual.steps) !== JSON.stringify(expected.steps)) diffs.push('per-step results differ');
    return diffs;
  };
},25,[2,16,22,23,17,24,14]);
__d(function (global, require, _$$_IMPORT_DEFAULT, _$$_IMPORT_ALL, module, exports, _dependencyMap) {
  "use strict";

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  Object.defineProperty(exports, "GOLDEN_EXPECTED", {
    enumerable: true,
    get: function () {
      return GOLDEN_EXPECTED;
    }
  });
  var _golden = require(_dependencyMap[0]);
  /**
   * Recorded outcome of the Package A golden scenario. Node, Vitest and the Expo/Hermes
   * diagnostics screen must all reproduce these values byte for byte. GENERATED by
   * `npm run golden:write`; regenerate only after an intentional, reviewed change to the
   * simulation or fixtures.
   */
  var GOLDEN_EXPECTED = {
    "scenario": _golden.GOLDEN_SCENARIO_ID,
    "worldId": _golden.GOLDEN_WORLD_ID,
    "finalSimDate": "2026-10-30",
    "revision": 3,
    "eventCount": 3,
    "rngDraws": 14,
    "commandDays": [1, 6, 7],
    "fingerprint": "fd3baa44a20b08e5e6f4948adc6f123da62c7239ad04062f185f8cec96a53bda",
    "eventChainHead": "d9c18cb91bcfe9f09afe2cbd58f154ceaea9cb65f7c0606c3c5a8e9729ff897a",
    "steps": [{
      "label": "advance-1",
      "outcome": "committed",
      "revision": 1,
      "rngDraws": 1,
      "fingerprint": "dde4d6daa87ca7f85a513fd101437d826b9665d975cd579de006d6bc1f612335",
      "chainHead": "88527b7579aff9d4dead44d04099536268aacbbbf42a1d0fd256964f5d6078d1"
    }, {
      "label": "advance-6",
      "outcome": "committed",
      "revision": 2,
      "rngDraws": 7,
      "fingerprint": "36b765558574271cad3a814a71daab797fd44dc9e3d0c18790072e069931b4f5",
      "chainHead": "34b10c517f54ed5415408f6e8da4f6df175c529add900ec78c659e1836099a77"
    }, {
      "label": "duplicate-command",
      "outcome": "DUPLICATE_COMMAND",
      "revision": 2,
      "rngDraws": 7,
      "fingerprint": "36b765558574271cad3a814a71daab797fd44dc9e3d0c18790072e069931b4f5",
      "chainHead": "34b10c517f54ed5415408f6e8da4f6df175c529add900ec78c659e1836099a77"
    }, {
      "label": "stale-revision",
      "outcome": "STALE_REVISION",
      "revision": 2,
      "rngDraws": 7,
      "fingerprint": "36b765558574271cad3a814a71daab797fd44dc9e3d0c18790072e069931b4f5",
      "chainHead": "34b10c517f54ed5415408f6e8da4f6df175c529add900ec78c659e1836099a77"
    }, {
      "label": "invalid-days",
      "outcome": "INVALID_PAYLOAD",
      "revision": 2,
      "rngDraws": 7,
      "fingerprint": "36b765558574271cad3a814a71daab797fd44dc9e3d0c18790072e069931b4f5",
      "chainHead": "34b10c517f54ed5415408f6e8da4f6df175c529add900ec78c659e1836099a77"
    }, {
      "label": "unauthorized-actor",
      "outcome": "UNAUTHORIZED_ACTOR",
      "revision": 2,
      "rngDraws": 7,
      "fingerprint": "36b765558574271cad3a814a71daab797fd44dc9e3d0c18790072e069931b4f5",
      "chainHead": "34b10c517f54ed5415408f6e8da4f6df175c529add900ec78c659e1836099a77"
    }, {
      "label": "advance-7",
      "outcome": "committed",
      "revision": 3,
      "rngDraws": 14,
      "fingerprint": "fd3baa44a20b08e5e6f4948adc6f123da62c7239ad04062f185f8cec96a53bda",
      "chainHead": "d9c18cb91bcfe9f09afe2cbd58f154ceaea9cb65f7c0606c3c5a8e9729ff897a"
    }]
  };
},26,[25]);
__r(0);