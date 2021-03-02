'use strict';

const Mentions = require('./MessageMentions');
const Attachment = require('./MessageAttachment');
const Embed = require('./MessageEmbed');
const RichEmbed = require('./RichEmbed');
const MessageReaction = require('./MessageReaction');
const ReactionCollector = require('./ReactionCollector');
const Util = require('../util/Util');
const Collection = require('../util/Collection');
const Constants = require('../util/Constants');
const Permissions = require('../util/Permissions');
const MessageFlags = require('../util/MessageFlags');
const Sticker = require('../structures/Sticker');
let GuildMember;

/**
 * Represents a message on Discord.
 */
class Message {
    constructor(channel, data, client) {
        /**
         * The client that instantiated the Message
         * @name Message#client
         * @type {Client}
         * @readonly
         */
        Object.defineProperty(this, 'client', { value: client });

        /**
         * The channel that the message was sent in
         * @type {TextChannel|DMChannel|GroupDMChannel}
         */
        this.channel = channel;

        /**
         * Whether this message has been deleted
         * @type {boolean}
         */
        this.deleted = false;

        if (data) this.setup(data);
    }

    setup(data) { // eslint-disable-line complexity
        /**
         * The ID of the message
         * @type {Snowflake}
         */
        this.id = data.id;
		
		this.inlineReply = (data.type == 19);

        /**
         * The type of the message
         * @type {MessageType}
         */
        this.type = Constants.MessageTypes[(data.type == 19 ? 0 : data.type)];

        /**
         * The content of the message
         * @type {string}
         */
        this.content = data.content || null;

        /**
         * The author of the message
         * @type {User}
         */
        this.author = data.author ? this.client.dataManager.newUser(data.author, !data.webhook_id) : null;

        /**
         * Whether or not this message is pinned
         * @type {boolean}
         */
        this.pinned = data.pinned;

        /**
         * Whether or not the message was Text-To-Speech
         * @type {boolean}
         */
        this.tts = data.tts;

        /**
         * A random number or string used for checking message delivery
         * <warn>This is only received after the message was sent successfully, and
         * lost if re-fetched</warn>
         * @type {?string}
         */
        this.nonce = data.nonce;

        /**
         * Whether or not this message was sent by Discord, not actually a user (e.g. pin notifications)
         * @type {boolean}
         */
        this.system = data.type !== 0;

        /**
         * A list of embeds in the message - e.g. YouTube Player
         * @type {MessageEmbed[]}
         */
        this.embeds = data.embeds ? data.embeds.map(e => new Embed(this, e)) : null;

        /**
         * A collection of attachments in the message - e.g. Pictures - mapped by their ID
         * @type {Collection<Snowflake, MessageAttachment>}
         */
		if(data.attachments) {
			this.attachments = new Collection();
			for(const attachment of data.attachments) this.attachments.set(attachment.id, new Attachment(this, attachment));
		} else {
			this.attachments = null;
		}
		
        /**
         * The timestamp the message was sent at
         * @type {number}
         */
        this.createdTimestamp = new Date(data.timestamp).getTime();

        /**
         * The timestamp the message was last edited at (if applicable)
         * @type {?number}
         */
        this.editedTimestamp = data.edited_timestamp ? new Date(data.edited_timestamp).getTime() : null;

        /**
         * A collection of reactions to this message, mapped by the reaction ID
         * @type {Collection<Snowflake, MessageReaction>}
         */
        this.reactions = new Collection();
        if (data.reactions && data.reactions.length > 0) {
            for (const reaction of data.reactions) {
                const id = reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;
                this.reactions.set(id, new MessageReaction(this, reaction.emoji, reaction.count, reaction.me));
            }
        }

        /**
         * All valid mentions that the message contains
         * @type {MessageMentions}
         */
        this.mentions = new Mentions(this, data.mentions, data.mention_roles, data.mention_everyone, data.mention_channels);

        /**
         * ID of the webhook that sent the message, if applicable
         * @type {?Snowflake}
         */
        this.webhookID = data.webhook_id || null;

        /**
         * Whether this message is a hit in a search
         * @type {?boolean}
         */
        this.hit = typeof data.hit === 'boolean' ? data.hit : null;

        /**
         * Flags that are applied to the message
         * @type {Readonly<MessageFlags>}
         */
        this.flags = new MessageFlags(data.flags).freeze();
		
		this.stickers = new Collection;
		for(let sticker of (data.stickers || [])) {
			this.stickers.set(sticker.id, new Sticker(sticker));
		}

        /**
         * Reference data sent in a crossposted message.
         * @typedef {Object} MessageReference
         * @property {string} channelID ID of the channel the message was crossposted from
         * @property {?string} guildID ID of the guild the message was crossposted from
         * @property {?string} messageID ID of the message that was crossposted
         */

        /**
         * Message reference data
         * @type {?MessageReference}
         */
        this.reference = data.message_reference ? {
            channelID: data.message_reference.channel_id,
            guildID: data.message_reference.guild_id,
            messageID: data.message_reference.message_id,
        } : null;

        /**
         * The previous versions of the message, sorted with the most recent first
         * @type {Message[]}
         * @private
         */
        this._edits = [];

        if (data.member && this.guild && this.author && !this.guild.members.has(this.author.id)) {
            this.guild._addMember(Object.assign(data.member, { user: this.author }), false);
        }

        /**
         * Represents the author of the message as a guild member
         * Only available if the message comes from a guild where the author is still a member
         * @type {?GuildMember}
         */
        this.member = this.guild ? this.guild.member(this.author) || null : null;
    }
	
	fetchReference() {
		if(this.reference) {
			const msgid  = this.reference.messageID;
			const cached = this.channel.messages.get(msgid);
			
			if(cached) return Promise.resolve(cached);
			return this.channel.fetchMessage(msgid);
		}
		
		return Promise.reject(Error('No reference in this message.'));
	}
	
	getReference() {
		if(!this.reference) throw Error('No reference.');
		return this.channel.messages.get(this.reference.messageID);
	}

    /**
     * Updates the message.
     * @param {Object} data Raw Discord message update data
     * @private
     */
    patch(data) {
        const clone = Util.cloneObject(this);
        this._edits.unshift(clone);

        if ('edited_timestamp' in data) this.editedTimestamp = new Date(data.edited_timestamp).getTime();
        if ('content' in data) this.content = data.content;
        if ('pinned' in data) this.pinned = data.pinned;
        if ('tts' in data) this.tts = data.tts;
        if ('embeds' in data) this.embeds = data.embeds.map(e => new Embed(this, e));
        else this.embeds = this.embeds.slice();

        if ('attachments' in data) {
            this.attachments = new Collection();
            for (const attachment of data.attachments) this.attachments.set(attachment.id, new Attachment(this, attachment));
        } else {
            this.attachments = new Collection(this.attachments);
        }

        this.mentions = new Mentions(
            this,
            'mentions' in data ? data.mentions : this.mentions.users,
            'mentions_roles' in data ? data.mentions_roles : this.mentions.roles,
            'mention_everyone' in data ? data.mention_everyone : this.mentions.everyone,
            'mention_channels' in data ? data.mention_channels : this.mentions.crosspostedChannels
        );

        this.flags = new MessageFlags('flags' in data ? data.flags : 0).freeze();
    }

    /**
     * The time the message was sent
     * @type {Date}
     * @readonly
     */
    get createdAt() {
        return new Date(this.createdTimestamp);
    }

    /**
     * The time the message was last edited at (if applicable)
     * @type {?Date}
     * @readonly
     */
    get editedAt() {
        return this.editedTimestamp ? new Date(this.editedTimestamp) : null;
    }

    /**
     * The guild the message was sent in (if in a guild channel)
     * @type {?Guild}
     * @readonly
     */
    get guild() {
        return this.channel.guild || null;
    }

    /**
     * The url to jump to the message
     * @type {string}
     * @readonly
     */
    get url() {
        return `https://discord.com/channels/${this.guild ? this.guild.id : '@me'}/${this.channel.id}/${this.id}`;
    }

    /**
     * The message contents with all mentions replaced by the equivalent text.
     * If mentions cannot be resolved to a name, the relevant mention in the message content will not be converted.
     * @type {string}
     * @readonly
     */
    get cleanContent() {
        return this.content
            .replace(/@(everyone|here)/g, '@\u200b$1')
            .replace(/<@!?[0-9]+>/g, input => {
                const id = input.replace(/<|!|>|@/g, '');
                if (this.channel.type === 'dm' || this.channel.type === 'group') {
                    return this.client.users.has(id) ? `@${this.client.users.get(id).username}` : input;
                }

                const member = this.channel.guild.members.get(id);
                if (member) {
                    if (member.nickname) return `@${member.nickname}`;
                    return `@${member.user.username}`;
                } else {
                    const user = this.client.users.get(id);
                    if (user) return `@${user.username}`;
                    return input;
                }
            })
            .replace(/<#[0-9]+>/g, input => {
                const channel = this.client.channels.get(input.replace(/<|#|>/g, ''));
                if (channel) return `#${channel.name}`;
                return input;
            })
            .replace(/<@&[0-9]+>/g, input => {
                if (this.channel.type === 'dm' || this.channel.type === 'group') return input;
                const role = this.guild.roles.get(input.replace(/<|@|>|&/g, ''));
                if (role) return `@${role.name}`;
                return input;
            });
    }

    /**
     * Creates a reaction collector.
     * @param {CollectorFilter} filter The filter to apply
     * @param {ReactionCollectorOptions} [options={}] Options to send to the collector
     * @returns {ReactionCollector}
     * @example
     * // Create a reaction collector
     * const filter = (reaction, user) => reaction.emoji.name === '👌' && user.id === 'someID'
     * const collector = message.createReactionCollector(filter, { time: 15000 });
     * collector.on('collect', r => console.log(`Collected ${r.emoji.name}`));
     * collector.on('end', collected => console.log(`Collected ${collected.size} items`));
     */
    createReactionCollector(filter, options) { options = options || {};
        return new ReactionCollector(this, filter, options);
    }

    /**
     * An object containing the same properties as CollectorOptions, but a few more:
     * @typedef {ReactionCollectorOptions} AwaitReactionsOptions
     * @property {string[]} [errors] Stop/end reasons that cause the promise to reject
     */

    /**
     * Similar to createMessageCollector but in promise form.
     * Resolves with a collection of reactions that pass the specified filter.
     * @param {CollectorFilter} filter The filter function to use
     * @param {AwaitReactionsOptions} [options={}] Optional options to pass to the internal collector
     * @returns {Promise<Collection<string, MessageReaction>>}
     * @example
     * // Create a reaction collector
     * const filter = (reaction, user) => reaction.emoji.name === '👌' && user.id === 'someID'
     * message.awaitReactions(filter, { time: 15000 })
     *     .then(collected => console.log(`Collected ${collected.size} reactions`))
     *     .catch(console.error);
     */
    awaitReactions(filter, options) { options = options || {};
        return new Promise((resolve, reject) => {
            const collector = this.createReactionCollector(filter, options);
            collector.once('end', (reactions, reason) => {
                if (options.errors && options.errors.includes(reason)) reject(reactions);
                else resolve(reactions);
            });
        });
    }

    /**
     * An array of cached versions of the message, including the current version
     * Sorted from latest (first) to oldest (last)
     * @type {Message[]}
     * @readonly
     */
    get edits() {
        const copy = this._edits.slice();
        copy.unshift(this);
        return copy;
    }

    /**
     * Whether the message is editable by the client user
     * @type {boolean}
     * @readonly
     */
    get editable() {
        return this.author.id === this.client.user.id;
    }

    /**
     * Whether the message is deletable by the client user
     * @type {boolean}
     * @readonly
     */
    get deletable() {
        return !this.deleted && (this.author.id === this.client.user.id || (this.guild &&
            this.channel.permissionsFor(this.client.user).has(Permissions.FLAGS.MANAGE_MESSAGES)
        ));
    }

    /**
     * Whether the message is pinnable by the client user
     * @type {boolean}
     * @readonly
     */
    get pinnable() {
        return this.type === 'DEFAULT' && (!this.guild ||
            this.channel.permissionsFor(this.client.user).has(Permissions.FLAGS.MANAGE_MESSAGES));
    }

    /**
     * Whether or not a user, channel or role is mentioned in this message.
     * @param {GuildChannel|User|Role|string} data Either a guild channel, user or a role object, or a string representing
     * the ID of any of these
     * @returns {boolean}
     */
    isMentioned(data) {
        data = data && data.id ? data.id : data;
        return this.mentions.users.has(data) || this.mentions.channels.has(data) || this.mentions.roles.has(data);
    }

    /**
     * Whether or not a guild member is mentioned in this message. Takes into account
     * user mentions, role mentions, and @everyone/@here mentions.
     * @param {GuildMember|User} member The member/user to check for a mention of
     * @returns {boolean}
     */
    isMemberMentioned(member) {
        // Lazy-loading is used here to get around a circular dependency that breaks things
        if (!GuildMember) GuildMember = require('./GuildMember');
        if (this.mentions.everyone) return true;
        if (this.mentions.users.has(member.id)) return true;
        if (member instanceof GuildMember && member.roles.some(r => this.mentions.roles.has(r.id))) return true;
        return false;
    }

    /**
     * Options that can be passed into editMessage.
     * @typedef {Object} MessageEditOptions
     * @property {Object} [embed] An embed to be added/edited
     * @property {string|boolean} [code] Language for optional codeblock formatting to apply
     * @property {MessageFlagsResolvable} [flags] Message flags to apply
     */

    /**
     * Edit the content of the message.
     * @param {StringResolvable} [content] The new content for the message
     * @param {MessageEditOptions|RichEmbed} [options] The options to provide
     * @returns {Promise<Message>}
     * @example
     * // Update the content of a message
     * message.edit('This is my new content!')
     *     .then(msg => console.log(`New message content: ${msg}`))
     *     .catch(console.error);
     */
    edit(content, options) {
        if (!options && typeof content === 'object' && !(content instanceof Array)) {
            options = content;
            content = '';
        } else if (!options) {
            options = {};
        }
        if (options instanceof RichEmbed) options = { embed: options };
        return this.client.rest.methods.updateMessage(this, content, options);
    }

    /**
     * Edit the content of the message, with a code block.
     * @param {string} lang The language for the code block
     * @param {StringResolvable} content The new content for the message
     * @returns {Promise<Message>}
     * @deprecated
     */
    editCode(lang, content) {
        content = Util.escapeMarkdown(this.client.resolver.resolveString(content), true);
        return this.edit(`\`\`\`${lang || ''}\n${content}\n\`\`\``);
    }

    /**
     * Pins this message to the channel's pinned messages.
     * @returns {Promise<Message>}
     */
    pin() {
        return this.client.rest.methods.pinMessage(this);
    }

    /**
     * Unpins this message from the channel's pinned messages.
     * @returns {Promise<Message>}
     */
    unpin() {
        return this.client.rest.methods.unpinMessage(this);
    }

    /**
     * Add a reaction to the message.
     * @param {string|Emoji|ReactionEmoji} emoji The emoji to react with
     * @returns {Promise<MessageReaction>}
     * @example
     * // React to a message with a unicode emoji
     * message.react('🤔')
     *     .then(console.log)
     *     .catch(console.error);
     * @example
     * // React to a message with a custom emoji
     * message.react(message.guild.emojis.get('123456789012345678'))
     *     .then(console.log)
     *     .catch(console.error);
     */
    react(emoji) {
        emoji = this.client.resolver.resolveEmojiIdentifier(emoji);
        if (!emoji) throw new TypeError('Emoji must be a string or Emoji/ReactionEmoji');

        return this.client.rest.methods.addMessageReaction(this, emoji);
    }

    /**
     * Remove all reactions from a message.
     * @returns {Promise<Message>}
     */
    clearReactions() {
        return this.client.rest.methods.removeMessageReactions(this);
    }

    /**
     * Deletes the message.
     * @param {number} [timeout=0] How long to wait to delete the message in milliseconds
     * @returns {Promise<Message>}
     * @example
     * // Delete a message
     * message.delete()
     *     .then(msg => console.log(`Deleted message from ${msg.author.username}`))
     *     .catch(console.error);
     */
    delete(timeout) { if(timeout===undefined) timeout = 0;
        if (timeout <= 0) {
            return this.client.rest.methods.deleteMessage(this);
        } else {
            return new Promise(resolve => {
                this.client.setTimeout(() => {
                    resolve(this.delete());
                }, timeout);
            });
        }
    }
	
	get server() {
		return this.guild;
	}

    /**
     * Reply to the message.
     * @param {StringResolvable} [content] The content for the message
     * @param {MessageOptions} [options] The options to provide
     * @returns {Promise<Message|Message[]>}
     * @example
     * // Reply to a message
     * message.reply('Hey, I\'m a reply!')
     *     .then(sent => console.log(`Sent a reply to ${sent.author.username}`))
     *     .catch(console.error);
     */
    reply(content, options) {
        if (!options && typeof content === 'object' && !(content instanceof Array)) {
            options = content;
            content = '';
        } else if (!options) {
            options = {};
        }
        return this.channel.send(content, Object.assign(options, { reply: this.member || this.author }));
    }
    
    reply2(content, ping, options) { options = options || {};
        options.reference = {
            message_id: this.id,
            channel_id: this.channel.id,
            guild_id:   this.guild.id
        };
        
        if(ping == 0) {  // false == 0 is true
            options.allowed_mentions = {
                parse: ["users", "roles", "everyone"],
                replied_user: false
            };
        }
        
        return this.channel.send(content, options);
    }
    
    quote(content, options) { options = options || {};
        const orgmsg = this.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        var omq = '';
        for(var ln of orgmsg.split('\n')) {
            omq += '> ' + ln + '\n';
        }
        
        content = omq + `${this.member} ${content}`;
        return this.channel.send(content, options);
    }
	
	// https://github.com/discordjs/discord.js/blob/master/src/structures/Message.js
	get partial() {
		return typeof this.content !== 'string' || !this.author;
	}
	
	fetch(force) {
		return this.channel.fetchMessage(this.id);
	}

    /**
     * Marks the message as read.
     * <warn>This is only available when using a user account.</warn>
     * @returns {Promise<Message>}
     * @deprecated
     */
    acknowledge() {
        return this.client.rest.methods.ackMessage(this);
    }

    /**
     * Fetches the webhook used to create this message.
     * @returns {Promise<?Webhook>}
     */
    fetchWebhook() {
        if (!this.webhookID) return Promise.reject(new Error('The message was not sent by a webhook.'));
        return this.client.fetchWebhook(this.webhookID);
    }

    /**
     * Suppresses or unsuppresses embeds on a message
     * @param {boolean} [suppress=true] If the embeds should be suppressed or not
     * @returns {Promise<Message>}
     */
    suppressEmbeds(suppress) { if(suppress===undefined) suppress = true;
        const flags = new MessageFlags(this.flags.bitfield);

        if (suppress) {
            flags.add(MessageFlags.FLAGS.SUPPRESS_EMBEDS);
        } else {
            flags.remove(MessageFlags.FLAGS.SUPPRESS_EMBEDS);
        }

        return this.edit(undefined, { flags });
    }

    /**
     * Used mainly internally. Whether two messages are identical in properties. If you want to compare messages
     * without checking all the properties, use `message.id === message2.id`, which is much more efficient. This
     * method allows you to see if there are differences in content, embeds, attachments, nonce and tts properties.
     * @param {Message} message The message to compare it to
     * @param {Object} rawData Raw data passed through the WebSocket about this message
     * @returns {boolean}
     */
    equals(message, rawData) {
        if (!message) return false;
        const embedUpdate = !message.author && !message.attachments;
        if (embedUpdate) return this.id === message.id && this.embeds.length === message.embeds.length;

        let equal = this.id === message.id &&
            this.author.id === message.author.id &&
            this.content === message.content &&
            this.tts === message.tts &&
            this.nonce === message.nonce &&
            this.embeds.length === message.embeds.length &&
            this.attachments.length === message.attachments.length;

        if (equal && rawData) {
            equal = this.mentions.everyone === message.mentions.everyone &&
                this.createdTimestamp === new Date(rawData.timestamp).getTime() &&
                this.editedTimestamp === new Date(rawData.edited_timestamp).getTime();
        }

        return equal;
    }

    /**
     * When concatenated with a string, this automatically concatenates the message's content instead of the object.
     * @returns {string}
     * @example
     * // Logs: Message: This is a message!
     * console.log(`Message: ${message}`);
     */
    toString() {
        return this.content;
    }

    _addReaction(emoji, user) {
        const emojiID = emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name;
        let reaction;
        if (this.reactions.has(emojiID)) {
            reaction = this.reactions.get(emojiID);
            if (!reaction.me) reaction.me = user.id === this.client.user.id;
        } else {
            reaction = new MessageReaction(this, emoji, 0, user.id === this.client.user.id);
            this.reactions.set(emojiID, reaction);
        }
        if (!reaction.users.has(user.id)) {
            reaction.users.set(user.id, user);
            reaction.count++;
        }
        return reaction;
    }

    _removeReaction(emoji, user) {
        const emojiID = emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name;
        if (this.reactions.has(emojiID)) {
            const reaction = this.reactions.get(emojiID);
            if (!user) {
                this.reactions.delete(emojiID);
                return reaction;
            }
            if (reaction.users.has(user.id)) {
                reaction.users.delete(user.id);
                reaction.count--;
                if (user.id === this.client.user.id) reaction.me = false;
                if (reaction.count <= 0) this.reactions.delete(emojiID);
                return reaction;
            }
        }
        return null;
    }

    _clearReactions() {
        this.reactions.clear();
    }
}

module.exports = Message;
