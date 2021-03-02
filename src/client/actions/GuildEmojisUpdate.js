'use strict';

const Action = require('./Action');

function mappify(iterable) {
  const map = new Map();
  var _map;
	function _toConsumableArray(arr) {
	  if (Array.isArray(arr)) {
		var i = 0;
		var arr2 = Array(arr.length);
		for (; i < arr.length; i++) {
		  arr2[i] = arr[i];
		}
		return arr2;
	  } else {
		return Array.from(arr);
	  }
	}
	
  for (const x of iterable) (_map = map).set.apply(_map, _toConsumableArray(x));
  return map;
}

class GuildEmojisUpdateAction extends Action {
  handle(data) {
    const guild = this.client.guilds.get(data.guild_id);
    if (!guild || !guild.emojis) return;

    const deletions = mappify(guild.emojis.entries());

    for (const emoji of data.emojis) {
      // Determine type of emoji event
      const cachedEmoji = guild.emojis.get(emoji.id);
      if (cachedEmoji) {
        deletions.delete(emoji.id);
        if (!cachedEmoji.equals(emoji, true)) {
          // Emoji updated
          this.client.actions.GuildEmojiUpdate.handle(cachedEmoji, emoji);
        }
      } else {
        // Emoji added
        this.client.actions.GuildEmojiCreate.handle(guild, emoji);
      }
    }

    for (const emoji of deletions.values()) {
      // Emoji deleted
      this.client.actions.GuildEmojiDelete.handle(emoji);
    }
  }
}

module.exports = GuildEmojisUpdateAction;
