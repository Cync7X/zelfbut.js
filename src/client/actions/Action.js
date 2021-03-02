'use strict';

const PartialTypes = require('../../util/Constants').PartialTypes;
const Message = require('../../structures/Message');

/*

ABOUT ACTIONS

Actions are similar to WebSocket Packet Handlers, but since introducing
the REST API methods, in order to prevent rewriting code to handle data,
"actions" have been introduced. They're basically what Packet Handlers
used to be but they're strictly for manipulating data and making sure
that WebSocket events don't clash with REST methods.

*/

class GenericAction {
  constructor(client) {
    this.client = client;
  }

  handle(data) {
    return data;
  }
  
  // https://github.com/discordjs/discord.js/blob/cee6cf70ce76e9b06dc7f25bfd77498e18d7c8d4/src/client/actions/Action.js#L51
  getPayload(data, manager, id, partialType, cache, cls) {
    const existing = manager.get(id);
    if(!existing && this.client.options.partials.includes(partialType)) {
      const existing = manager.get(id || data.id);
      if (existing && existing._patch && cache) existing._patch(data);
      if (existing) return existing;

      var entry;
	  if(cls == Message) entry = new cls(this.client.channels.get(data.channel_id), data, this.client);
      if(cache) manager.set(id || entry.id, entry);
      return entry;
    }
    return existing;
  }
  
  getMessage(data, channel, cache) {
    const id = data.message_id || data.id;
    return (
      data.message ||
      this.getPayload (
        {
          id,
          channel_id: channel.id,
          guild_id: data.guild_id || (channel.guild ? channel.guild.id : null),
        },
        channel.messages,
        id,
        PartialTypes.MESSAGE,
        cache,
		Message
      )
    );
  }
}

module.exports = GenericAction;
