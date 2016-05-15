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


var estupendoWrapper = function estupendoWrapper(){

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
    var wrapSrc = estupendoWrapper.toString()
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
            var error = new Error('riww ERROR: Async request worker timed out', arguments);
            worker.terminate();
            reject(error);
        }, timeout);
    });
};