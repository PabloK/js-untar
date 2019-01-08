;(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.untar = factory();
  }
}(this, function() {
"use strict";
/* globals window: false, Promise: false */

/**
Returns a Promise decorated with a progress() event.
*/
function ProgressivePromise(fn) {
	if (typeof Promise !== "function") {
		throw new Error("Promise implementation not available in this environment.");
	}

	var progressCallbacks = [];
	var progressHistory = [];

	function doProgress(value) {
		for (var i = 0, l = progressCallbacks.length; i < l; ++i) {
			progressCallbacks[i](value);
		}

		progressHistory.push(value);
	}

	var promise = new Promise(function(resolve, reject) {
		fn(resolve, reject, doProgress);
	});

	promise.progress = function(cb) {
		if (typeof cb !== "function") {
			throw new Error("cb is not a function.");
		}

		// Report the previous progress history
		for (var i = 0, l = progressHistory.length; i < l; ++i) {
			cb(progressHistory[i]);
		}

		progressCallbacks.push(cb);
		return promise;
	};

	var origThen = promise.then;

	promise.then = function(onSuccess, onFail, onProgress) {
		origThen.call(promise, onSuccess, onFail);

		if (onProgress !== undefined) {
			promise.progress(onProgress);
		}

		return promise;
	};

	return promise;
}
/* globals Blob: false, Promise: false, console: false, Worker: false, ProgressivePromise: false */

var workerScriptUri; // Included at compile time

var global = window || this;

var URL = global.URL || global.webkitURL;

/**
Returns a ProgressivePromise.
*/
function untar(arrayBuffer) {
	if (!(arrayBuffer instanceof ArrayBuffer)) {
		throw new TypeError("arrayBuffer is not an instance of ArrayBuffer.");
	}

	if (!global.Worker) {
		throw new Error("Worker implementation is not available in this environment.");
	}

	return new ProgressivePromise(function(resolve, reject, progress) {
		var worker = new Worker(workerScriptUri);

		var files = [];

		worker.onerror = function(err) {
			reject(err);
		};

		worker.onmessage = function(message) {
			message = message.data;

			switch (message.type) {
				case "log":
					console[message.data.level]("Worker: " + message.data.msg);
					break;
				case "extract":
					var file = decorateExtractedFile(message.data);
					files.push(file);
					progress(file);
					break;
				case "complete":
					worker.terminate();
					resolve(files);
					break;
				case "error":
					//console.log("error message");
					worker.terminate();
					reject(new Error(message.data.message));
					break;
				default:
					worker.terminate();
					reject(new Error("Unknown message from worker: " + message.type));
					break;
			}
		};

		//console.info("Sending arraybuffer to worker for extraction.");
		worker.postMessage({ type: "extract", buffer: arrayBuffer }, [arrayBuffer]);
	});
}

var decoratedFileProps = {
	blob: {
		get: function() {
			return this._blob || (this._blob = new Blob([this.buffer]));
		}
	},
	getBlobUrl: {
		value: function() {
			return this._blobUrl || (this._blobUrl = URL.createObjectURL(this.blob));
		}
	},
	readAsString: {
		value: function() {
			var buffer = this.buffer;
			var charCount = buffer.byteLength;
			var charSize = 1;
			var byteCount = charCount * charSize;
			var bufferView = new DataView(buffer);

			var charCodes = [];

			for (var i = 0; i < charCount; ++i) {
				var charCode = bufferView.getUint8(i * charSize, true);
				charCodes.push(charCode);
			}

			return (this._string = String.fromCharCode.apply(null, charCodes));
		}
	},
	readAsJSON: {
		value: function() {
			return JSON.parse(this.readAsString());
		}
	}
};

function decorateExtractedFile(file) {
	Object.defineProperties(file, decoratedFileProps);
	return file;
}


workerScriptUri = (window||this).URL.createObjectURL(new Blob(["\"use strict\";function UntarWorker(){}function decodeUTF8(e){for(var r=\"\",t=0;t<e.length;){var a=e[t++];if(a>127){if(a>191&&a<224){if(t>=e.length)throw\"UTF-8 decode: incomplete 2-byte sequence\";a=(31&a)<<6|63&e[t]}else if(a>223&&a<240){if(t+1>=e.length)throw\"UTF-8 decode: incomplete 3-byte sequence\";a=(15&a)<<12|(63&e[t])<<6|63&e[++t]}else{if(!(a>239&&a<248))throw\"UTF-8 decode: unknown multibyte start 0x\"+a.toString(16)+\" at index \"+(t-1);if(t+2>=e.length)throw\"UTF-8 decode: incomplete 4-byte sequence\";a=(7&a)<<18|(63&e[t])<<12|(63&e[++t])<<6|63&e[++t]}++t}if(a<=65535)r+=String.fromCharCode(a);else{if(!(a<=1114111))throw\"UTF-8 decode: code point 0x\"+a.toString(16)+\" exceeds UTF-16 reach\";a-=65536,r+=String.fromCharCode(a>>10|55296),r+=String.fromCharCode(1023&a|56320)}}return r}function PaxHeader(e){this._fields=e}function TarFile(){}function UntarStream(e){this._bufferView=new DataView(e),this._position=0}function UntarFileStream(e){this._stream=new UntarStream(e),this._globalPaxHeader=null}if(UntarWorker.prototype={onmessage:function(e){try{if(\"extract\"!==e.data.type)throw new Error(\"Unknown message type: \"+e.data.type);this.untarBuffer(e.data.buffer)}catch(r){this.postError(r)}},postError:function(e){this.postMessage({type:\"error\",data:{message:e.message}})},postLog:function(e,r){this.postMessage({type:\"log\",data:{level:e,msg:r}})},untarBuffer:function(e){try{for(var r=new UntarFileStream(e);r.hasNext();){var t=r.next();this.postMessage({type:\"extract\",data:t},[t.buffer])}this.postMessage({type:\"complete\"})}catch(a){this.postError(a)}},postMessage:function(e,r){self.postMessage(e,r)}},\"undefined\"!=typeof self){var worker=new UntarWorker;self.onmessage=function(e){worker.onmessage(e)}}PaxHeader.parse=function(e){for(var r=new Uint8Array(e),t=[];r.length>0;){var a=parseInt(decodeUTF8(r.subarray(0,r.indexOf(32)))),n=decodeUTF8(r.subarray(0,a)),i=n.match(/^\\d+ ([^=]+)=(.*)\\n$/);if(null===i)throw new Error(\"Invalid PAX header data format.\");var s=i[1],o=i[2];0===o.length?o=null:null!==o.match(/^\\d+$/)&&(o=parseInt(o));var f={name:s,value:o};t.push(f),r=r.subarray(a)}return new PaxHeader(t)},PaxHeader.prototype={applyHeader:function(e){this._fields.forEach(function(r){var t=r.name,a=r.value;\"path\"===t?(t=\"name\",void 0!==e.prefix&&delete e.prefix):\"linkpath\"===t&&(t=\"linkname\"),null===a?delete e[t]:e[t]=a})}},UntarStream.prototype={readString:function(e){for(var r=1,t=e*r,a=[],n=0;n<e;++n){var i=this._bufferView.getUint8(this.position()+n*r,!0);if(0===i)break;a.push(i)}return this.seek(t),String.fromCharCode.apply(null,a)},readBuffer:function(e){var r;if(\"function\"==typeof ArrayBuffer.prototype.slice)r=this._bufferView.buffer.slice(this.position(),this.position()+e);else{r=new ArrayBuffer(e);var t=new Uint8Array(r),a=new Uint8Array(this._bufferView.buffer,this.position(),e);t.set(a)}return this.seek(e),r},seek:function(e){this._position+=e},peekUint32:function(){return this._bufferView.getUint32(this.position(),!0)},position:function(e){return void 0===e?this._position:void(this._position=e)},size:function(){return this._bufferView.byteLength}},UntarFileStream.prototype={hasNext:function(){return this._stream.position()+4<this._stream.size()&&0!==this._stream.peekUint32()},next:function(){return this._readNextFile()},_readNextFile:function(){var e=this._stream,r=new TarFile,t=!1,a=null,n=e.position(),i=n+512;switch(r.name=e.readString(100),r.mode=e.readString(8),r.uid=parseInt(e.readString(8)),r.gid=parseInt(e.readString(8)),r.size=parseInt(e.readString(12),8),r.mtime=parseInt(e.readString(12),8),r.checksum=parseInt(e.readString(8)),r.type=e.readString(1),r.linkname=e.readString(100),r.ustarFormat=e.readString(6),r.ustarFormat.indexOf(\"ustar\")>-1&&(r.version=e.readString(2),r.uname=e.readString(32),r.gname=e.readString(32),r.devmajor=parseInt(e.readString(8)),r.devminor=parseInt(e.readString(8)),r.namePrefix=e.readString(155),r.namePrefix.length>0&&(r.name=r.namePrefix+\"/\"+r.name)),e.position(i),r.type){case\"0\":case\"\":r.buffer=e.readBuffer(r.size);break;case\"1\":break;case\"2\":break;case\"3\":break;case\"4\":break;case\"5\":break;case\"6\":break;case\"7\":break;case\"g\":t=!0,this._globalPaxHeader=PaxHeader.parse(e.readBuffer(r.size));break;case\"x\":t=!0,a=PaxHeader.parse(e.readBuffer(r.size))}void 0===r.buffer&&(r.buffer=new ArrayBuffer(0));var s=i+r.size;return r.size%512!==0&&(s+=512-r.size%512),e.position(s),t&&(r=this._readNextFile()),null!==this._globalPaxHeader&&this._globalPaxHeader.applyHeader(r),null!==a&&a.applyHeader(r),r}};"]));
return untar;
}));
