'use strict';

const TextChannel = require('./TextChannel');

/**
 * Represents a guild news channel on Discord.
 * @extends {TextChannel}
 */
class NewsChannel extends TextChannel {
  constructor(guild, data) {
    super(guild, data);
    this.type = 'news';
  }

  setup(data) {
    super.setup(data);

    /**
     * The ratelimit per user for this channel (always 0)
     * @type {number}
     */
    this.rateLimitPerUser = 0;
  }
  
  addFollower(channel) {
    // 주소: /api/v8/channels/채널번호/followers
    // 데이타 webhook_channel_id: 공지가 올라올 채널 번호
    // 반환값 channel_id: 원래 공지 채널
    // 반환값 webhook_id: 웹후크 번호
    
    return this.client.rest.methods.followNewsChannel(this.id, typeof channel == 'string' ? channel : channel.id);
  }
  
  follow() {
    return this.addFollower.apply(this, arguments);
  }
}

module.exports = NewsChannel;
