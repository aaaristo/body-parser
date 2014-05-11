
var bytes = require('bytes');
var getBody = require('raw-body');
var typeis = require('type-is');
var http = require('http');
var qs = require('qs');

var charsetRegExp = /; * charset *= *("(?:[\u0000-\u0021\u0023-\u005b\u005d-\u007f]|\\[\u0000-\u007f])*"|[\u0000-\u007f]+)/
var firstcharRegExp = /^\s*(.)/
var slice = Array.prototype.slice

exports = module.exports = bodyParser;
exports.json = json;
exports.urlencoded = urlencoded;

function bodyParser(options){
  var opts = {}

  options = options || {}

  // exclude type option
  for (var prop in options) {
    if ('type' !== prop) {
      opts[prop] = options[prop]
    }
  }

  var _urlencoded = urlencoded(opts)
  var _json = json(opts)

  return function bodyParser(req, res, next) {
    _json(req, res, function(err){
      if (err) return next(err);
      _urlencoded(req, res, next);
    });
  }
}

function json(options){
  options = options || {};

  var limit = typeof options.limit !== 'number'
    ? bytes(options.limit || '100kb')
    : options.limit;
  var reviver = options.reviver
  var strict = options.strict !== false;
  var type = options.type || 'json';
  var verify = options.verify || false

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  function parse(str) {
    if (0 === str.length) {
      throw new Error('invalid json, empty body')
    }
    if (strict) {
      var first = firstchar(str)

      if (first !== '{' && first !== '[') {
        throw new Error('invalid json')
      }
    }

    return JSON.parse(str, reviver)
  }

  return function jsonParser(req, res, next) {
    if (req._body) return next();
    req.body = req.body || {}

    if (!typeis(req, type)) return next();

    var charset = charsetis(req, 'utf-8')
    if (charset === false) {
      return next(error(415, 'unsupported charset'))
    }

    // read
    read(req, res, next, parse, {
      encoding: charset,
      limit: limit,
      verify: verify
    })
  }
}

function urlencoded(options){
  options = options || {};

  var limit = typeof options.limit !== 'number'
    ? bytes(options.limit || '100kb')
    : options.limit;
  var type = options.type || 'urlencoded';
  var verify = options.verify || false;

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  function parse(str) {
    return str.length
      ? qs.parse(str)
      : {}
  }

  return function urlencodedParser(req, res, next) {
    if (req._body) return next();
    req.body = req.body || {}

    if (!typeis(req, type)) return next();

    var charset = charsetis(req, 'utf-8')
    if (charset === false) {
      return next(error(415, 'unsupported charset'))
    }

    // read
    read(req, res, next, parse, {
      encoding: charset,
      limit: limit,
      verify: verify
    })
  }
}

function charsetis(req, charsets) {
  var type = req.headers['content-type']

  if (!type) return false

  charsets = !Array.isArray(charsets)
    ? slice.call(arguments, 1)
    : charsets

  // get charset
  var match = charsetRegExp.exec(type)
  var charset = match
    ? match[1].toLowerCase()
    : undefined;

  // no charsets, return the charset
  if (!charsets || !charsets.length) return charset

  // no charset, return undefined
  if (!charset) return undefined

  return ~charsets.indexOf(charset)
    ? charset
    : false;
}

function error(code, msg) {
  var err = new Error(msg || http.STATUS_CODES[code]);
  err.status = code;
  return err;
}

function firstchar(str) {
  if (!str) return ''
  var match = firstcharRegExp.exec(str)
  return match ? match[1] : ''
}

function read(req, res, next, parse, options) {
  var length = req.headers['content-length']

  // flag as parsed
  req._body = true

  options = options || {}
  options.length = length

  var encoding = options.encoding || 'utf-8'
  var verify = options.verify

  options.encoding = verify
    ? null
    : encoding

  // read body
  getBody(req, options, function (err, body) {
    if (err) return next(err)
    var str

    // verify
    if (verify) {
      try {
        verify(req, res, body, encoding)
      } catch (err) {
        if (!err.status) err.status = 403
        return next(err)
      }
    }

    // parse
    try {
      str = typeof body !== 'string'
        ? body.toString(encoding)
        : body
      req.body = parse(str)
    } catch (err){
      err.body = str
      err.status = 400
      return next(err)
    }

    next()
  })
}
