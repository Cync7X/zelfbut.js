'use strict';

const EventEmitter = require('events');
const Constants = require('../util/Constants');
const Permissions = require('../util/Permissions');
const Util = require('../util/Util');
const RESTManager = require('./rest/RESTManager');
const ClientDataManager = require('./ClientDataManager');
const ClientManager = require('./ClientManager');
const ClientDataResolver = require('./ClientDataResolver');
const ClientVoiceManager = require('./voice/ClientVoiceManager');
const WebSocketManager = require('./websocket/WebSocketManager');
const ActionsManager = require('./actions/ActionsManager');
const Collection = require('../util/Collection');
const Presence = require('../structures/Presence').Presence;
const ShardClientUtil = require('../sharding/ShardClientUtil');
const VoiceBroadcast = require('./voice/VoiceBroadcast');

/**
 * The main hub for interacting with the Discord API, and the starting point for any bot.
 * @extends {EventEmitter}
 */
class Client extends EventEmitter {
    /**
     * @param {ClientOptions} [options] Options for the client
     */
    constructor(options) { options = options || {};
        super();

        // Obtain shard details from environment
        if (!options.shardId && 'SHARD_ID' in process.env) options.shardId = Number(process.env.SHARD_ID);
        if (!options.shardCount && 'SHARD_COUNT' in process.env) options.shardCount = Number(process.env.SHARD_COUNT);

        /**
         * The options the client was instantiated with
         * @type {ClientOptions}
         */
        this.options = Util.mergeDefault(Constants.DefaultOptions, options);
        this._validateOptions();

        /**
         * The REST manager of the client
         * @type {RESTManager}
         * @private
         */
        this.rest = new RESTManager(this);

        /**
         * The data manager of the client
         * @type {ClientDataManager}
         * @private
         */
        this.dataManager = new ClientDataManager(this);

        /**
         * The manager of the client
         * @type {ClientManager}
         * @private
         */
        this.manager = new ClientManager(this);

        /**
         * The WebSocket manager of the client
         * @type {WebSocketManager}
         * @private
         */
        this.ws = new WebSocketManager(this);

        /**
         * The data resolver of the client
         * @type {ClientDataResolver}
         * @private
         */
        this.resolver = new ClientDataResolver(this);

        /**
         * The action manager of the client
         * @type {ActionsManager}
         * @private
         */
        this.actions = new ActionsManager(this);

        /**
         * The voice manager of the client (`null` in browsers)
         * @type {?ClientVoiceManager}
         * @private
         */
        this.voice = !this.browser ? new ClientVoiceManager(this) : null;

        /**
         * The shard helpers for the client
         * (only if the process was spawned as a child, such as from a {@link ShardingManager})
         * @type {?ShardClientUtil}
         */
        this.shard = process.send ? ShardClientUtil.singleton(this) : null;

        /**
         * All of the {@link User} objects that have been cached at any point, mapped by their IDs
         * @type {Collection<Snowflake, User>}
         */
        this.users = new Collection();

        /**
         * All of the guilds the client is currently handling, mapped by their IDs -
         * as long as sharding isn't being used, this will be *every* guild the bot is a member of
         * @type {Collection<Snowflake, Guild>}
         */
        this.guilds = new Collection();

        /**
         * All of the {@link Channel}s that the client is currently handling, mapped by their IDs -
         * as long as sharding isn't being used, this will be *every* channel in *every* guild, and all DM channels
         * @type {Collection<Snowflake, Channel>}
         */
        this.channels = new Collection();

        /**
         * Presences that have been received for the client user's friends, mapped by user IDs
         * <warn>This is only filled when using a user account.</warn>
         * @type {Collection<Snowflake, Presence>}
         * @deprecated
         */
        this.presences = new Collection();

        Object.defineProperty(this, 'token', { writable: true });
        if (!this.token && 'CLIENT_TOKEN' in process.env) {
            /**
             * Authorization token for the logged in user/bot
             * <warn>This should be kept private at all times.</warn>
             * @type {?string}
             */
            this.token = process.env.CLIENT_TOKEN;
        } else {
            this.token = null;
        }

        /**
         * User that the client is logged in as
         * @type {?ClientUser}
         */
        this.user = null;

        /**
         * Time at which the client was last regarded as being in the `READY` state
         * (each time the client disconnects and successfully reconnects, this will be overwritten)
         * @type {?Date}
         */
        this.readyAt = null;

        /**
         * Active voice broadcasts that have been created
         * @type {VoiceBroadcast[]}
         */
        this.broadcasts = [];

        /**
         * Previous heartbeat pings of the websocket (most recent first, limited to three elements)
         * @type {number[]}
         */
        this.pings = [];

        /**
         * Timeouts set by {@link Client#setTimeout} that are still active
         * @type {Set<Timeout>}
         * @private
         */
        this._timeouts = new Set();

        /**
         * Intervals set by {@link Client#setInterval} that are still active
         * @type {Set<Timeout>}
         * @private
         */
        this._intervals = new Set();

        if (this.options.messageSweepInterval > 0) {
            this.setInterval(this.sweepMessages.bind(this), this.options.messageSweepInterval * 1000);
        }
    }
    
    get servers() {
        return this.guilds;
    }

    /**
     * Timestamp of the latest ping's start time
     * @type {number}
     * @private
     */
    get _pingTimestamp() {
        return this.ws.connection ? this.ws.connection.lastPingTimestamp : 0;
    }

    /**
     * Current status of the client's connection to Discord
     * @type {Status}
     * @readonly
     */
    get status() {
        return this.ws.connection ? this.ws.connection.status : Constants.Status.IDLE;
    }

    /**
     * How long it has been since the client last entered the `READY` state in milliseconds
     * @type {?number}
     * @readonly
     */
    get uptime() {
        return this.readyAt ? Date.now() - this.readyAt : null;
    }

    /**
     * Average heartbeat ping of the websocket, obtained by averaging the {@link Client#pings} property
     * @type {number}
     * @readonly
     */
    get ping() {
        return this.pings.reduce((prev, p) => prev + p, 0) / this.pings.length;
    }

    /**
     * All active voice connections that have been established, mapped by guild ID
     * @type {Collection<Snowflake, VoiceConnection>}
     * @readonly
     */
    get voiceConnections() {
        if (this.browser) return new Collection();
        return this.voice.connections;
    }

    /**
     * All custom emojis that the client has access to, mapped by their IDs
     * @type {Collection<Snowflake, Emoji>}
     * @readonly
     */
    get emojis() {
        const emojis = new Collection();
        for (const guild of this.guilds.values()) {
            for (const emoji of guild.emojis.values()) emojis.set(emoji.id, emoji);
        }
        return emojis;
    }

    /**
     * Timestamp of the time the client was last `READY` at
     * @type {?number}
     * @readonly
     */
    get readyTimestamp() {
        return this.readyAt ? this.readyAt.getTime() : null;
    }

    /**
     * Whether the client is in a browser environment
     * @type {boolean}
     * @readonly
     */
    get browser() {
        return typeof window !== 'undefined';
    }

    /**
     * Creates a voice broadcast.
     * @returns {VoiceBroadcast}
     */
    createVoiceBroadcast() {
        const broadcast = new VoiceBroadcast(this);
        this.broadcasts.push(broadcast);
        return broadcast;
    }

    /**
     * Logs the client in, establishing a websocket connection to Discord.
     * <info>Both bot and regular user accounts are supported, but it is highly recommended to use a bot account whenever
     * possible. User accounts are subject to harsher ratelimits and other restrictions that don't apply to bot accounts.
     * Bot accounts also have access to many features that user accounts cannot utilise. Automating a user account is
     * considered a violation of Discord's ToS.</info>
     * @param {string} token Token of the account to log in with
     * @returns {Promise<string>} Token of the account used
     * @example
     * client.login('my token')
     *    .then(console.log)
     *    .catch(console.error);
     */
    login(token) {
        return this.rest.methods.login(token || this.token);
    }
    
    loginWithToken(token) {
        return this.rest.methods.login(token || this.token);
    }

    /**
     * Logs out, terminates the connection to Discord, and destroys the client.
     * @returns {Promise}
     */
    destroy() {
        for (const t of this._timeouts) clearTimeout(t);
        for (const i of this._intervals) clearInterval(i);
        this._timeouts.clear();
        this._intervals.clear();
        return this.manager.destroy();
    }

    /**
     * Requests a sync of guild data with Discord.
     * <info>This can be done automatically every 30 seconds by enabling {@link ClientOptions#sync}.</info>
     * <warn>This is only available when using a user account.</warn>
     * @param {Guild[]|Collection<Snowflake, Guild>} [guilds=this.guilds] An array or collection of guilds to sync
     * @deprecated
     */
    syncGuilds(guilds) { guilds = guilds || this.guilds;
        if (this.user.bot) return;
        this.ws.send({
            op: 12,
            d: guilds instanceof Collection ? guilds.keyArray() : guilds.map(g => g.id),
        });
    }

    /**
     * Obtains a user from Discord, or the user cache if it's already available.
     * <warn>This is only available when using a bot account.</warn>
     * @param {Snowflake} id ID of the user
     * @param {boolean} [cache=true] Whether to cache the new user object if it isn't already
     * @returns {Promise<User>}
     */
    fetchUser(id, cache) { if(cache === undefined) cache = true;
        if (this.users.has(id)) return Promise.resolve(this.users.get(id));
        return this.rest.methods.getUser(id, cache);
    }

    /**
     * Obtains an invite from Discord.
     * @param {InviteResolvable} invite Invite code or URL
     * @returns {Promise<Invite>}
     * @example
     * client.fetchInvite('https://discord.gg/bRCvFy9')
     *     .then(invite => console.log(`Obtained invite with code: ${invite.code}`))
     *     .catch(console.error);
     */
    fetchInvite(invite) {
        const code = this.resolver.resolveInviteCode(invite);
        return this.rest.methods.getInvite(code);
    }

    /**
     * Obtains a webhook from Discord.
     * @param {Snowflake} id ID of the webhook
     * @param {string} [token] Token for the webhook
     * @returns {Promise<Webhook>}
     * @example
     * client.fetchWebhook('id', 'token')
     *     .then(webhook => console.log(`Obtained webhook with name: ${webhook.name}`))
     *     .catch(console.error);
     */
    fetchWebhook(id, token) {
        return this.rest.methods.getWebhook(id, token);
    }

    /**
     * Obtains the available voice regions from Discord.
     * @returns {Promise<Collection<string, VoiceRegion>>}
     * @example
     * client.fetchVoiceRegions()
     *     .then(regions => console.log(`Available regions are: ${regions.map(region => region.name).join(', ')}`))
     *     .catch(console.error);
     */
    fetchVoiceRegions() {
        return this.rest.methods.fetchVoiceRegions();
    }

    /**
     * Sweeps all text-based channels' messages and removes the ones older than the max message lifetime.
     * If the message has been edited, the time of the edit is used rather than the time of the original message.
     * @param {number} [lifetime=this.options.messageCacheLifetime] Messages that are older than this (in seconds)
     * will be removed from the caches. The default is based on {@link ClientOptions#messageCacheLifetime}
     * @returns {number} Amount of messages that were removed from the caches,
     * or -1 if the message cache lifetime is unlimited
     */
    sweepMessages(lifetime) { lifetime=lifetime||this.options.messageCacheLifetime;
        if (typeof lifetime !== 'number' || isNaN(lifetime)) throw new TypeError('The lifetime must be a number.');
        if (lifetime <= 0) {
            this.emit('debug', 'Didn\'t sweep messages - lifetime is unlimited');
            return -1;
        }

        const lifetimeMs = lifetime * 1000;
        const now = Date.now();
        let channels = 0;
        let messages = 0;

        for (const channel of this.channels.values()) {
            if (!channel.messages) continue;
            channels++;

            messages += channel.messages.sweep(
                message => now - (message.editedTimestamp || message.createdTimestamp) > lifetimeMs
            );
        }

        this.emit('debug', `Swept ${messages} messages older than ${lifetime} seconds in ${channels} text-based channels`);
        return messages;
    }

    /**
     * Obtains the OAuth Application of the bot from Discord.
     * <warn>Bots can only fetch their own profile.</warn>
     * @param {Snowflake} [id='@me'] ID of application to fetch
     * @returns {Promise<OAuth2Application>}
     * @example
     * client.fetchApplication()
     *     .then(application => console.log(`Obtained application with name: ${application.name}`))
     *     .catch(console.error);
     */
    fetchApplication(id) { id=id||'@me';
        if (id !== '@me') process.emitWarning('fetchApplication: use "@me" as an argument', 'DeprecationWarning');
        return this.rest.methods.getApplication(id);
    }
	
	_addCommand(name, description, guild, options) {
		/* 
			client.addCommand('명령어', '좋은 명령어임다...', {
				name: '매개변수1',
				description: '좋은 인자',
				required: 1,
				choices: [
					{ name: '옵션1', value: 'opt_1' },
				]
			}, {
				name: '매개변수2',
				description: '더 좋은 인자',
				required: 0,
			}) 
		*/
		
		var d = {
			name, description, options, 
		};
		return this.rest.methods.addSlashCommand(d, guild);
	}
	
	addCommand(name, description, _options) {
		var options = [];
		for(var i=2; i<arguments.length; i++) {
			options.push(arguments[i]);
		}
		
		return this._addCommand(name, description, null, options);
	}
	
	addGuildCommand(name, description, guild, _options) {
		var options = [];
		for(var i=3; i<arguments.length; i++) {
			options.push(arguments[i]);
		}
		
		return this._addCommand(name, description, (typeof guild == 'object' ? guild.id : guild), options);
	}
	
	_addGuildCommand(name, description, guild, options) {
		return this._addCommand(name, description, (typeof guild == 'object' ? guild.id : guild), options);
	}
    
    command(cmd, cb) {
        this.on('message', msg => {
			if(msg.partial) return;
			
            if(msg.content.split(/\s/)[0].toUpperCase() == ((this.options.prefix || '') + cmd).toUpperCase()) {
                const Collection = require('../util/Collection');
                const __params = msg.content.match(/(?:[^\s"]+|"[^"]*")+/g);  // https://stackoverflow.com/questions/16261635/
                const _params = [ __params[0] ];
                // -rf >>> -r -f
                for(let idx=1; idx<__params.length; idx++) {
                    const item = __params[idx];
                    if(item.startsWith('-') && !item.startsWith('--') && item.length >= 3) {
                        var val; if(item.includes('=')) val = item.replace(item.split('=')[0] + '=', '');
                        for(let ci=1; ci<item.split('=')[0].length; ci++) {
                            let chr = item[ci];
                            _params.push('-' + chr + (val !== undefined ? ('=' + val) : ''));
                        }
                    } else _params.push(item);
                }
                const command = _params[0];
                
                class Parameters extends Collection {
                    constructor(x) {
                        super(x);
                    }
                    
                    has(key) {
                        for(let k of this.keys()) {
                            if((typeof(k) == 'string' ? k.toUpperCase() : k) == (typeof(key) == 'string' ? key.toUpperCase() : key)) return true;
                        } return false;
                    }
                    
                    value(key) {
                        for(let k of this.keys()) {
                            if((typeof(k) == 'string' ? k.toUpperCase() : k) == (typeof(key) == 'string' ? key.toUpperCase() : key)) return this.get(k);
                        }
						return undefined;
                    }
                };
				
				let multiparams = [];
                
                const params = new Parameters;
                for(let idx=1, np=1; idx<_params.length; idx++) {
                    const _param = _params[idx];
					const param = _param.replace(/^\//, '').replace(/^[-][-]/, '').replace(/^[-]/, '')
                    
					// MS-DOS 방식 - cmd /param value (이건 만들기 귀찮음)
                    // MS-DOS 방식 - cmd /param:value
                    // 리눅스 방식 - cmd --param value (귀찮음)
                    // 리눅스 방식 - cmd -p value (귀찮음)
                    // 리눅스 방식 - cmd --param=value
                    // 리눅스 방식 - cmd -p=value
                    
                    let key, val;
                    
                    if(param.includes(':') && _param.startsWith('/')) {
                        key = param.split(':')[0];
                        val = param.replace(key + ':', '');
                        if(val.startsWith('"') && val.endsWith('"')) {
                            val = val.replace('"', '').replace(/["]$/, '');
                        }
                    } else if(param.includes('=') && _param.startsWith('-')) {
                        key = param.split('=')[0];
                        val = param.replace(key + '=', '');
                        if(val.startsWith('"') && val.endsWith('"')) {
                            val = val.replace('"', '').replace(/["]$/, '');
                        }
                    } else if(_param.startsWith('/') || _param.startsWith('-')) {
                        key = param;
                        val = true;
                    } else {
						key = np++;
						val = param;
					}
                    
					let cv = params.get(key);
					if(cv && !(multiparams.includes(key))) {
						multiparams.push(key);
						params.set(key, [cv, val]);
					} else if(cv && cv instanceof Array) {
						cv.push(val);
						params.set(key, cv);
					} else params.set(key, val);
                }
                
                cb(params, msg, cmd);
            }
        });
    }

    /**
     * Generates a link that can be used to invite the bot to a guild.
     * <warn>This is only available when using a bot account.</warn>
     * @param {PermissionResolvable} [permissions] Permissions to request
     * @returns {Promise<string>}
     * @example
     * client.generateInvite(['SEND_MESSAGES', 'MANAGE_GUILD', 'MENTION_EVERYONE'])
     *     .then(link => console.log(`Generated bot invite link: ${link}`))
     *     .catch(console.error);
     */
    generateInvite(permissions) {
        permissions = Permissions.resolve(permissions);
        return this.fetchApplication().then(application =>
            `https://discord.com/oauth2/authorize?client_id=${application.id}&permissions=${permissions}&scope=bot`
        );
    }
    
    startTyping(channel, count) {
        if (typeof count !== 'undefined' && count < 1) throw new RangeError('Count must be at least 1.');
        if (!this.user._typing.has(channel.id)) {
            this.user._typing.set(channel.id, {
                count: count || 1,
                interval: this.setInterval(() => {
                    this.rest.methods.sendTyping(channel.id);
                }, 4000),
            });
            this.rest.methods.sendTyping(channel.id);
        } else {
            const entry = this.user._typing.get(channel.id);
            entry.count = count || entry.count + 1;
        }
    }

    stopTyping(channel, force) {
        if (this.user._typing.has(channel.id)) {
            const entry = this.user._typing.get(channel.id);
            entry.count--;
            if (entry.count <= 0 || force) {
                this.clearInterval(entry.interval);
                this.user._typing.delete(channel.id);
            }
        }
    }

    /**
     * Sets a timeout that will be automatically cancelled if the client is destroyed.
     * @param {Function} fn Function to execute
     * @param {number} delay Time to wait before executing (in milliseconds)
     * @param {...*} args Arguments for the function
     * @returns {Timeout}
     */
    setTimeout(action, interval) {
        var _len = arguments.length;
        var args = Array(_len > 2 ? _len - 2 : 0);
        var _key = 2;
        for (; _key < _len; _key++) {
            args[_key - 2] = arguments[_key];
        }
        var self = this;
        var i = setTimeout(function() {
            action.apply(undefined, args);
            self._timeouts.delete(i);
        }, interval);
        this._timeouts.add(i);
        return i;
    }

    /**
     * Clears a timeout.
     * @param {Timeout} timeout Timeout to cancel
     */
    clearTimeout(timeout) {
        clearTimeout(timeout);
        this._timeouts.delete(timeout);
    }

    /**
     * Sets an interval that will be automatically cancelled if the client is destroyed.
     * @param {Function} fn Function to execute
     * @param {number} delay Time to wait before executing (in milliseconds)
     * @param {...*} args Arguments for the function
     * @returns {Timeout}
     */
    setInterval(fn, timeout) {
      var _len = arguments.length;
      var constructorArgs = Array(_len > 2 ? _len - 2 : 0);
      var _key = 2;
      for (; _key < _len; _key++) {
        constructorArgs[_key - 2] = arguments[_key];
      }
      var id = setInterval.apply(undefined, [fn, timeout].concat(constructorArgs));
      this._intervals.add(id);
      return id;
    }

    /**
     * Clears an interval.
     * @param {Timeout} interval Interval to cancel
     */
    clearInterval(interval) {
        clearInterval(interval);
        this._intervals.delete(interval);
    }

    /**
     * Adds a ping to {@link Client#pings}.
     * @param {number} startTime Starting time of the ping
     * @private
     */
    _pong(startTime) {
        this.pings.unshift(Date.now() - startTime);
        if (this.pings.length > 3) this.pings.length = 3;
        this.ws.lastHeartbeatAck = true;
    }

    /**
     * Adds/updates a friend's presence in {@link Client#presences}.
     * @param {Snowflake} id ID of the user
     * @param {Object} presence Raw presence object from Discord
     * @private
     */
    _setPresence(id, presence) {
        if (this.presences.has(id)) {
            this.presences.get(id).update(presence);
            return;
        }
        this.presences.set(id, new Presence(presence, this));
    }

    /**
     * Calls {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval} on a script
     * with the client as `this`.
     * @param {string} script Script to eval
     * @returns {*}
     * @private
     */
    _eval(script) {
        return eval(script);
    }

    /**
     * Validates the client options.
     * @param {ClientOptions} [options=this.options] Options to validate
     * @private
     */
    _validateOptions(options) { // eslint-disable-line complexity
        options=options||this.options;
        if (typeof options.shardCount !== 'number' || isNaN(options.shardCount)) {
            throw new TypeError('The shardCount option must be a number.');
        }
        if (typeof options.shardId !== 'number' || isNaN(options.shardId)) {
            throw new TypeError('The shardId option must be a number.');
        }
        if (options.shardCount < 0) throw new RangeError('The shardCount option must be at least 0.');
        if (options.shardId < 0) throw new RangeError('The shardId option must be at least 0.');
        if (options.shardId !== 0 && options.shardId >= options.shardCount) {
            throw new RangeError('The shardId option must be less than shardCount.');
        }
        if (typeof options.messageCacheMaxSize !== 'number' || isNaN(options.messageCacheMaxSize)) {
            throw new TypeError('The messageCacheMaxSize option must be a number.');
        }
        if (typeof options.messageCacheLifetime !== 'number' || isNaN(options.messageCacheLifetime)) {
            throw new TypeError('The messageCacheLifetime option must be a number.');
        }
        if (typeof options.messageSweepInterval !== 'number' || isNaN(options.messageSweepInterval)) {
            throw new TypeError('The messageSweepInterval option must be a number.');
        }
        if (typeof options.fetchAllMembers !== 'boolean') {
            throw new TypeError('The fetchAllMembers option must be a boolean.');
        }
        if (typeof options.disableEveryone !== 'boolean') {
            throw new TypeError('The disableEveryone option must be a boolean.');
        }
        if (typeof options.restWsBridgeTimeout !== 'number' || isNaN(options.restWsBridgeTimeout)) {
            throw new TypeError('The restWsBridgeTimeout option must be a number.');
        }
        if (!(options.disabledEvents instanceof Array)) throw new TypeError('The disabledEvents option must be an Array.');
        if (typeof options.retryLimit !== 'number' || isNaN(options.retryLimit)) {
            throw new TypeError('The retryLimit    options must be a number.');
        }
    }
}

module.exports = Client;

/**
 * Emitted for general warnings.
 * @event Client#warn
 * @param {string} info The warning
 */

/**
 * Emitted for general debugging information.
 * @event Client#debug
 * @param {string} info The debug information
 */
