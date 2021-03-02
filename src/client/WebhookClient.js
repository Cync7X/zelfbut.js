'use strict';

const Webhook = require('../structures/Webhook');
const RESTManager = require('./rest/RESTManager');
const ClientDataResolver = require('./ClientDataResolver');
const Constants = require('../util/Constants');
const Util = require('../util/Util');

/**
 * The webhook client.
 * @extends {Webhook}
 */
class WebhookClient extends Webhook {
  /**
   * @param {Snowflake} id ID of the webhook
   * @param {string} token Token of the webhook
   * @param {ClientOptions} [options] Options for the client
   * @example
   * // Create a new webhook and send a message
   * const hook = new Discord.WebhookClient('1234', 'abcdef');
   * hook.sendMessage('This will send a message').catch(console.error);
   */
  constructor(id, token, options) {
    super(null, id, token);

    /**
     * The options the client was instantiated with
     * @type {ClientOptions}
     */
    this.options = Util.mergeDefault(Constants.DefaultOptions, options);

    /**
     * The REST manager of the client
     * @type {RESTManager}
     * @private
     */
    this.rest = new RESTManager(this);

    /**
     * The data resolver of the client
     * @type {ClientDataResolver}
     * @private
     */
    this.resolver = new ClientDataResolver(this);

    /**
     * Timeouts set by {@link WebhookClient#setTimeout} that are still active
     * @type {Set<Timeout>}
     * @private
     */
    this._timeouts = new Set();

    /**
     * Intervals set by {@link WebhookClient#setInterval} that are still active
     * @type {Set<Timeout>}
     * @private
     */
    this._intervals = new Set();
  }

  /**
   * Sets a timeout that will be automatically cancelled if the client is destroyed.
   * @param {Function} fn Function to execute
   * @param {number} delay Time to wait before executing (in milliseconds)
   * @param {...*} args Arguments for the function
   * @returns {Timeout}
   */
  setTimeout(fn$jscomp$0, delay$jscomp$0) {
	  var _len$jscomp$0 = arguments.length;
	  var args$jscomp$0 = Array(_len$jscomp$0 > 2 ? _len$jscomp$0 - 2 : 0);
	  var _key$jscomp$0 = 2;
	  for (; _key$jscomp$0 < _len$jscomp$0; _key$jscomp$0++) {
		args$jscomp$0[_key$jscomp$0 - 2] = arguments[_key$jscomp$0];
	  }
	  var _this$jscomp$0 = this;
	  var timeout$jscomp$1 = setTimeout(function() {
		fn$jscomp$0.apply(undefined, args$jscomp$0);
		_this$jscomp$0._timeouts.delete(timeout$jscomp$1);
	  }, delay$jscomp$0);
	  this._timeouts.add(timeout$jscomp$1);
	  return timeout$jscomp$1;
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
  setInterval(fn$jscomp$0, delay$jscomp$0) {
	  var _len$jscomp$0 = arguments.length;
	  var args$jscomp$0 = Array(_len$jscomp$0 > 2 ? _len$jscomp$0 - 2 : 0);
	  var _key$jscomp$0 = 2;
	  for (; _key$jscomp$0 < _len$jscomp$0; _key$jscomp$0++) {
		args$jscomp$0[_key$jscomp$0 - 2] = arguments[_key$jscomp$0];
	  }
	  var interval$jscomp$0 = setInterval.apply(undefined, [fn$jscomp$0, delay$jscomp$0].concat(args$jscomp$0));
	  this._intervals.add(interval$jscomp$0);
	  return interval$jscomp$0;
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
   * Destroys the client.
   */
  destroy() {
    for (const t of this._timeouts) clearTimeout(t);
    for (const i of this._intervals) clearInterval(i);
    this._timeouts.clear();
    this._intervals.clear();
  }
}

module.exports = WebhookClient;
