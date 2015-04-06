module.exports = function(global) {
  var previous_trace = null;
  var appDir = Ti.Filesystem.resourcesDirectory;

  var exports = {
    async_trace_limit: 10
  }

  var limit_frames = function(stack) {
    if (exports.async_trace_limit <= 0) {
      return;
    }

    var count = exports.async_trace_limit - 1;
    var trace = stack;
    while ((trace != null) && count > 1) {
      trace = trace.__previous__;
      --count;
    }
    if (trace != null) {
      Ti.API.info('Dropping ti-longjohn frame');
      return delete trace.__previous__;
    }
  };

  var collect_frames = function(stack) {
    var trace = stack;
    var frames = [trace.name + ' at ' + trace.sourceURL.replace(appDir, '') + ':' + trace.line];
    while (trace != null) {
      if (trace.__location__) {
        frames.push('-------- ' + trace.__location__ + ' ---------');
      }
      var lines = trace.backtrace.split('\n');
      lines = lines.filter(function (line) { return line.indexOf(__filename) === -1; });
      lines = lines.map(function (line) { return line.replace(appDir, ''); });
      frames = frames.concat(lines);
      trace = trace.__previous__;
    }
    return frames;
  };

  var create_trace = function (location) {
    try {
      i.dont.exist();
    }
    catch (trace_error) {
      trace_error.__location__ = location;
      trace_error.__previous__ = previous_trace;
      limit_frames(trace_error);
      return trace_error;
    }
  };

  var call_callback_with_trace = function(trace, callback, args) {
    var old_previous_trace = previous_trace;
    previous_trace = trace;
    try {
      return callback.apply(this, args);
    } catch (_error) {
      if (!_error.longjohn) {
        _error.__previous__ = previous_trace;
        _error.longjohn = collect_frames(_error);
        _error.__previous__ = undefined;
      }
      throw _error;
    } finally {
      previous_trace = old_previous_trace;
    }
  };

  var wrap_callback = function(callback, location) {
    var trace = create_trace(location);
    return function() {
      return call_callback_with_trace(trace, callback, arguments);
    };
  };

  // global entrypoints
  var _setTimeout = global.setTimeout;
  var _setInterval = global.setInterval;

  global.setTimeout = function(callback) {
    var args;
    args = Array.prototype.slice.call(arguments);
    args[0] = wrap_callback(callback, 'setTimeout');
    return _setTimeout.apply(this, args);
  };

  global.setInterval = function(callback) {
    var args;
    args = Array.prototype.slice.call(arguments);
    args[0] = wrap_callback(callback, 'setInterval');
    return _setInterval.apply(this, args);
  };

  // setImmediate entrypoint – Not actually part of Titanium, but if some
  // library implements it, we wrap it.
  if (global.setImmediate != null) {
    var _setImmediate = global.setImmediate;
    global.setImmediate = function(callback) {
      var args;
      args = Array.prototype.slice.call(arguments);
      args[0] = wrap_callback(callback, 'global.setImmediate');
      return _setImmediate.apply(this, args);
    };
  }

  // process entrypoints – not actually part of Titanium, but if some library
  // like Ti.node.JS implements it, we wrap it.
  try {
    var process = require('process');

    var _nextTick = process.nextTick;
    var __nextDomainTick = process._nextDomainTick;

    process.nextTick = function (callback) {
      var args;
      args = Array.prototype.slice.call(arguments);
      args[0] = wrap_callback(callback, 'process.nextTick');
      return _nextTick.apply(this, args);
    };

    process._nextDomainTick = function (callback) {
      var args;
      args = Array.prototype.slice.call(arguments);
      args[0] = wrap_callback(callback, 'process._nextDomainTick');
      return __nextDomainTick.apply(this, args);
    };
  }
  catch (err) {
  }

  // library patch functions
  exports.patch_async = function(async) {
    var _queue = async.queue;
    async.queue = function(worker, concurrency) {

      // a worker which dewraps the task
      var patched_worker = function(task, callback) {
        return call_callback_with_trace(task.previous_trace, worker, [task.data, callback]);
      };

      var q = _queue(patched_worker, concurrency);

      // async.push which wraps the task data
      var _push = q.push;
      q.push = function (data, callback) {
        var trace = create_trace('async.queue.push');
        return _push({
          data: data,
          previous_trace: trace
        }, callback);
      };

      // async.unshift which wraps the task data
      var _unshift = q.push;
      q.unshift = function (data, callback) {
        var trace = create_trace('async.queue.unshift');
        return _unshift({
          data: data,
          previous_trace: trace
        }, callback);
      };

      return q;
    }
  };

  return exports;
};
