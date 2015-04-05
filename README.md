# ti-longjohn [![Appcelerator Titanium](http://www-static.appcelerator.com/badges/titanium-git-badge-sq.png)]

Long stack traces for Titanium with configurable call trace length.

This module is a port and partially rewrite of the Node.js [longjohn](https://github.com/mattinsler/longjohn) for the Titanium platform.

In addition it has special support to patch [async.js](https://github.com/caolan/async)'s `queue`.

## Requirements

* [Titanium SDK 3.4+](http://www.appcelerator.com/titanium/titanium-sdk/)

## Supports

* iOS simulator and device

## Usage

To use ti-longjohn, require it in your code (probably in some initialization code). That's all!

```javascript
if (Ti.App.deployType !== 'production') {
  var longjohn = require('longjohn')(global);
}

// ... your code
```

where `global` is the global namespace. If you require `ti-longjohn` from the `app.js` file, pass `this` as the global parameter.

### Output

When an exception is thrown, ti-longjohn will try to construct a long backtrace which can consist of multiple usual backtraces which are seperated by asyncronous callbacks, e.g. by `setTimeout`.

The output looks like this:

```
"TypeError at node_modules/nedb/lib/model.js:31",
"#0 () at node_modules/nedb/lib/datastore.js:296",
"#1 () at node_modules/nedb/lib/datastore.js:528",
"#2 () at node_modules/nedb/lib/cursor.js:174",
"#3 () at node_modules/nedb/lib/datastore.js:530",
"#4 () at node_modules/nedb/node_modules/async/lib/async.js:582",
"#5 () at node_modules/nedb/node_modules/async/lib/async.js:498",
"#8 () at node_modules/process/index.js:14",
"-------- process.nextTick ---------",
"#2 () at node_modules/nedb/node_modules/async/lib/async.js:499",
"#3 () at node_modules/nedb/node_modules/async/lib/async.js:503",
"#4 () at node_modules/nedb/lib/datastore.js:564",
"#5 () at node_modules/nedb/lib/executor.js:40",
"#8 () at node_modules/nedb/node_modules/async/lib/async.js:731",
"#9 () at node_modules/nedb/node_modules/async/lib/async.js:728",
"#10 () at node_modules/nedb/node_modules/async/lib/async.js:24",
"#13 () at node_modules/process/index.js:14",
"-------- async.push ---------",
"#1 () at node_modules/nedb/lib/executor.js:56",
"#2 () at node_modules/nedb/lib/datastore.js:568",
"#3 () at models/thread.js:1687",
"#4 () at lib/async.js:122"
```

### Limit traced async calls

```javascript
longjohn.async_trace_limit = 5;   // defaults to 10
longjohn.async_trace_limit = -1;  // unlimited
```

### Patching async.js

The queue mechanism in async.js breaks the backtrace chain that ti-longjohn tries to build and which it prints on error.

There is special support to patch the async.js queue in such a way that proper long backtraces are created:

```javascript
var longjohn = require('ti-longjohn')(global);
longjohn.patch_async(require('async'));
```

Then the code

```javascript
var q = async.queue(function (x) {
    i.do.not.exist = x;
});
q.push(42, function done() {
    Ti.API.info('done');
});
```

will lead to a long backtrace:

```
"TypeError at app.js:19",
"#2 () at node_modules/async/lib/async.js:809",
"#5 () at node_modules/process/index.js:14",
"-------- async.push ---------",
"#1 () at app.js:23"
```
