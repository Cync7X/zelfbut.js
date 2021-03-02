'use strict';

/**
 * Data structure that makes it easy to interact with a bitfield.
 */
class BitField {
  /**
   * @param {BitFieldResolvable} [bits=0] Bits(s) to read from
   */
  constructor(bits) {
    /**
     * Bitfield of the packed bits
     * @type {number}
     */
    this.bitfield = this.constructor.resolve(bits);
  }

  /**
   * Checks whether the bitfield has a bit, or any of multiple bits.
   * @param {BitFieldResolvable} bit Bit(s) to check for
   * @returns {boolean}
   */
  any(bit) {
    return (this.bitfield & this.constructor.resolve(bit)) !== 0;
  }

  /**
   * Checks if this bitfield equals another
   * @param {BitFieldResolvable} bit Bit(s) to check for
   * @returns {boolean}
   */
  equals(bit) {
    return this.bitfield === this.constructor.resolve(bit);
  }

  /**
   * Checks whether the bitfield has a bit, or multiple bits.
   * @param {BitFieldResolvable} bit Bit(s) to check for
   * @returns {boolean}
   */
  has(bit) {
    if (Array.isArray(bit)) return bit.every(p => this.has(p));
    bit = this.constructor.resolve(bit);
    return (this.bitfield & bit) === bit;
  }

  /**
   * Gets all given bits that are missing from the bitfield.
   * @param {BitFieldResolvable} bits Bits(s) to check for
   * @param {...*} hasParams Additional parameters for the has method, if any
   * @returns {string[]}
   */
  missing(b) {
	  var _this = this;
	  var _len = arguments.length;
	  var originalArgs = Array(_len > 1 ? _len - 1 : 0);
	  var _key = 1;
	  for (; _key < _len; _key++) {
		originalArgs[_key - 1] = arguments[_key];
	  }
	  if (!Array.isArray(b)) {
		b = (new this.constructor(b)).toArray(false);
	  }
	  return b.filter(function(intfName) {
		return !_this.has.apply(_this, [intfName].concat(originalArgs));
	  });
	}

  /**
   * Freezes these bits, making them immutable.
   * @returns {Readonly<BitField>} These bits
   */
  freeze() {
    return Object.freeze(this);
  }

  /**
   * Adds bits to these ones.
   * @param {...BitFieldResolvable} [bits] Bits to add
   * @returns {BitField} These bits or new BitField if the instance is frozen.
   */
  add() {
	  var total$jscomp$0 = 0;
	  var _len$jscomp$0 = arguments.length;
	  var bits$jscomp$0 = Array(_len$jscomp$0);
	  var _key$jscomp$0 = 0;
	  for (; _key$jscomp$0 < _len$jscomp$0; _key$jscomp$0++) {
		bits$jscomp$0[_key$jscomp$0] = arguments[_key$jscomp$0];
	  }
	  var _iteratorNormalCompletion$jscomp$0 = true;
	  var _didIteratorError$jscomp$0 = false;
	  var _iteratorError$jscomp$0 = undefined;
	  try {
		var _iterator$jscomp$0 = bits$jscomp$0[Symbol.iterator]();
		var _step$jscomp$0;
		for (; !(_iteratorNormalCompletion$jscomp$0 = (_step$jscomp$0 = _iterator$jscomp$0.next()).done); _iteratorNormalCompletion$jscomp$0 = true) {
		  var bit$jscomp$0 = _step$jscomp$0.value;
		  total$jscomp$0 = total$jscomp$0 | this.constructor.resolve(bit$jscomp$0);
		}
	  } catch (err$jscomp$3) {
		_didIteratorError$jscomp$0 = true;
		_iteratorError$jscomp$0 = err$jscomp$3;
	  } finally {
		try {
		  if (!_iteratorNormalCompletion$jscomp$0 && _iterator$jscomp$0.return) {
			_iterator$jscomp$0.return();
		  }
		} finally {
		  if (_didIteratorError$jscomp$0) {
			throw _iteratorError$jscomp$0;
		  }
		}
	  }
	  if (Object.isFrozen(this)) {
		return new this.constructor(this.bitfield | total$jscomp$0);
	  }
	  this.bitfield |= total$jscomp$0;
	  return this;
	}

  /**
   * Removes bits from these.
   * @param {...BitFieldResolvable} [bits] Bits to remove
   * @returns {BitField} These bits or new BitField if the instance is frozen.
   */
  remove() {
	  var total$jscomp$0 = 0;
	  var _len$jscomp$0 = arguments.length;
	  var bits$jscomp$0 = Array(_len$jscomp$0);
	  var _key$jscomp$0 = 0;
	  for (; _key$jscomp$0 < _len$jscomp$0; _key$jscomp$0++) {
		bits$jscomp$0[_key$jscomp$0] = arguments[_key$jscomp$0];
	  }
	  var _iteratorNormalCompletion$jscomp$0 = true;
	  var _didIteratorError$jscomp$0 = false;
	  var _iteratorError$jscomp$0 = undefined;
	  try {
		var _iterator$jscomp$0 = bits$jscomp$0[Symbol.iterator]();
		var _step$jscomp$0;
		for (; !(_iteratorNormalCompletion$jscomp$0 = (_step$jscomp$0 = _iterator$jscomp$0.next()).done); _iteratorNormalCompletion$jscomp$0 = true) {
		  var bit$jscomp$0 = _step$jscomp$0.value;
		  total$jscomp$0 = total$jscomp$0 | this.constructor.resolve(bit$jscomp$0);
		}
	  } catch (err$jscomp$3) {
		_didIteratorError$jscomp$0 = true;
		_iteratorError$jscomp$0 = err$jscomp$3;
	  } finally {
		try {
		  if (!_iteratorNormalCompletion$jscomp$0 && _iterator$jscomp$0.return) {
			_iterator$jscomp$0.return();
		  }
		} finally {
		  if (_didIteratorError$jscomp$0) {
			throw _iteratorError$jscomp$0;
		  }
		}
	  }
	  if (Object.isFrozen(this)) {
		return new this.constructor(this.bitfield & ~total$jscomp$0);
	  }
	  this.bitfield &= ~total$jscomp$0;
	  return this;
	}

  /**
   * Gets an object mapping field names to a {@link boolean} indicating whether the
   * bit is available.
   * @param {...*} hasParams Additional parameters for the has method, if any
   * @returns {Object}
   */
  serialize() {
	  var serialized$jscomp$0 = {};
	  var _len$jscomp$0 = arguments.length;
	  var hasParams$jscomp$0 = Array(_len$jscomp$0);
	  var _key$jscomp$0 = 0;
	  for (; _key$jscomp$0 < _len$jscomp$0; _key$jscomp$0++) {
		hasParams$jscomp$0[_key$jscomp$0] = arguments[_key$jscomp$0];
	  }
	  var _iteratorNormalCompletion$jscomp$0 = true;
	  var _didIteratorError$jscomp$0 = false;
	  var _iteratorError$jscomp$0 = undefined;
	  try {
		var _iterator$jscomp$0 = Object.keys(this.constructor.FLAGS)[Symbol.iterator]();
		var _step$jscomp$0;
		for (; !(_iteratorNormalCompletion$jscomp$0 = (_step$jscomp$0 = _iterator$jscomp$0.next()).done); _iteratorNormalCompletion$jscomp$0 = true) {
		  var flag$jscomp$1 = _step$jscomp$0.value;
		  serialized$jscomp$0[flag$jscomp$1] = this.has.apply(this, [this.constructor.FLAGS[flag$jscomp$1]].concat(hasParams$jscomp$0));
		}
	  } catch (err$jscomp$3) {
		_didIteratorError$jscomp$0 = true;
		_iteratorError$jscomp$0 = err$jscomp$3;
	  } finally {
		try {
		  if (!_iteratorNormalCompletion$jscomp$0 && _iterator$jscomp$0.return) {
			_iterator$jscomp$0.return();
		  }
		} finally {
		  if (_didIteratorError$jscomp$0) {
			throw _iteratorError$jscomp$0;
		  }
		}
	  }
	  return serialized$jscomp$0;
	}

  /**
   * Gets an {@link Array} of bitfield names based on the bits available.
   * @param {...*} hasParams Additional parameters for the has method, if any
   * @returns {string[]}
   */
  toArray() {
	  var _this$jscomp$0 = this;
	  var _len$jscomp$0 = arguments.length;
	  var hasParams$jscomp$0 = Array(_len$jscomp$0);
	  var _key$jscomp$0 = 0;
	  for (; _key$jscomp$0 < _len$jscomp$0; _key$jscomp$0++) {
		hasParams$jscomp$0[_key$jscomp$0] = arguments[_key$jscomp$0];
	  }
	  return Object.keys(this.constructor.FLAGS).filter(function(bit$jscomp$0) {
		return _this$jscomp$0.has.apply(_this$jscomp$0, [bit$jscomp$0].concat(hasParams$jscomp$0));
	  });
	}

  toJSON() {
    return this.bitfield;
  }

  valueOf() {
    return this.bitfield;
  }

  *[Symbol.iterator]() {
    yield* this.toArray();
  }

  /**
   * Data that can be resolved to give a bitfield. This can be:
   * * A string (see {@link BitField.FLAGS})
   * * A bit number
   * * An instance of BitField
   * * An Array of BitFieldResolvable
   * @typedef {string|number|BitField|BitFieldResolvable[]} BitFieldResolvable
   */

  /**
   * Resolves bitfields to their numeric form.
   * @param {BitFieldResolvable} [bit=0] - bit(s) to resolve
   * @returns {number}
   */
  static resolve(bit) { bit=bit||0;
    if (typeof bit === 'number' && bit >= 0) return bit;
    if (bit instanceof BitField) return bit.bitfield;
    if (Array.isArray(bit)) return bit.map(p => this.resolve(p)).reduce((prev, p) => prev | p, 0);
    if (typeof bit === 'string' && typeof this.FLAGS[bit] !== 'undefined') return this.FLAGS[bit];
    throw new RangeError('Invalid bitfield flag or number.');
  }
}

/**
 * Numeric bitfield flags.
 * <info>Defined in extension classes</info>
 * @type {Object}
 * @abstract
 */
BitField.FLAGS = {};

module.exports = BitField;
