'use strict';

const MediaTranscoder = require('./transcoders/MediaTranscoder');

class Prism {
  constructor() {
    this.transcoder = new MediaTranscoder(this);
  }

  createTranscoder() {
	  return this.transcode.apply(this, arguments);
	}

  transcode() {
	  var _transcoder$jscomp$0;
	  return (_transcoder$jscomp$0 = this.transcoder).transcode.apply(_transcoder$jscomp$0, arguments);
	}
}

module.exports = Prism;
