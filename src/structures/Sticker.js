'use strict';

class Sticker {
	constructor(data) {
		this.setup(data);
	}
	
	setup(data) {
		this.id = data.id;
		this.packID = data.pack_id;
		this.name = data.name;
		this.description = data.description;
		this.tags = data.tags.split(', ');
		this.asset = data.asset, 
		this.previewAsset = data.preview_asset,
		this.type = data.format_type == 1 ? 'PNG' : (data.format_type == 2 ? 'APNG' : 'LOTTIE');
	}
}

module.exports = Sticker;
