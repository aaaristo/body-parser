
var assert = require('assert');
var http = require('http');
var request = require('supertest');

var bodyParser = require('..');

describe('bodyParser.urlencoded()', function(){
  var server
  before(function(){
    server = createServer()
  })

  it('should support all http methods', function(done){
    request(server)
    .get('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .set('Content-Length', 'user=tobi'.length)
    .send('user=tobi')
    .expect(200, '{"user":"tobi"}', done)
  })

  it('should parse x-www-form-urlencoded', function(done){
    request(server)
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('user=tobi')
    .expect(200, '{"user":"tobi"}', done)
  })

  describe('with limit option', function(){
    var server;
    var options;
    before(function(){
      options = { limit: '1kb' }
      server = createServer(options)
    })

    it('should 413 when over limit', function(done){
      var buf = new Buffer(1024)
      buf.fill('.')

      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('str=' + buf.toString())
      .expect(413, done)
    })

    it('should not change when options altered', function(done){
      var buf = new Buffer(1024)
      buf.fill('.')
      options.limit = '100kb'

      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('str=' + buf.toString())
      .expect(413, done)
    })
  })

  describe('with type option', function(){
    var server;
    before(function(){
      server = createServer({ type: 'application/vnd+x-www-form-urlencoded' })
    })

    it('should parse for custom type', function(done){
      request(server)
      .post('/')
      .set('Content-Type', 'application/vnd+x-www-form-urlencoded')
      .send('user=tobi')
      .expect(200, '{"user":"tobi"}', done)
    })

    it('should ignore standard type', function(done){
      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user=tobi')
      .expect(200, '{}', done)
    })
  })

  describe('with verify option', function(){
    var server;
    before(function(){
      server = createServer({verify: function(req, res, buf){
        if (buf[0] === 0x20) throw new Error('no leading space')
      }})
    })

    it('should error from verify', function(done){
      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(' user=tobi')
      .expect(403, 'no leading space', done)
    })
  })

  describe('encoding', function(){
    var server;
    before(function(){
      server = createServer()
    })

    it('should parse utf-8', function(done){
      var test = request(server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded; charset=utf-8')
      test.write(new Buffer('6e616d653de8aeba', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should parse when content-length != char length', function(done){
      var test = request(server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded; charset=utf-8')
      test.set('Content-Length', '7')
      test.write(new Buffer('746573743dc3a5', 'hex'))
      test.expect(200, '{"test":"å"}', done)
    })

    it('should default to utf-8', function(done){
      var test = request(server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(new Buffer('6e616d653de8aeba', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should fail on unknown encoding', function(done){
      var test = request(server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded; charset=koi8-r')
      test.write(new Buffer('6e616d653dcec5d4', 'hex'))
      test.expect(415, 'unsupported charset', done)
    })
  })
})

function createServer(opts){
  var _bodyParser = bodyParser.urlencoded(opts)

  return http.createServer(function(req, res){
    _bodyParser(req, res, function(err){
      res.statusCode = err ? (err.status || 500) : 200;
      res.end(err ? err.message : JSON.stringify(req.body));
    })
  })
}
