// dependencies
var express      = require('express');
var profile_time = require('../lib/profile_time');

// built-in node 
var assert       = require("assert");
var fs           = require('fs');
var http         = require('http');
var util         = require('util');

var SERVER_LISTEN_PORT = 3000;

var logfn = __dirname + '/test.server.log';
fs.writeFileSync(logfn, ''); // truncate any existing file


describe('with only testing profile_time', function(){
	var myProfiler;
	var logs = [];
	var delayMs = 300;

	// setup custom logger for profile_time to add to our logs array
	function myLogger(data) {
		logs.push(data)
	}
	before(function(done){
		profile_time.config({ logger: myLogger });
		myProfiler = profile_time.Profiler();
		myProfiler.begin('chad');
		setTimeout(function(){
			myProfiler.end('chad').done();
			done();
		}, delayMs);
	});

	it('should log to logger', function(){
		assert(logs.length >= 1);
	})

	it('should parse logs correctly', function(){
		var line = myProfiler.parseLogLine(logs[0]);
		assert(typeof line == 'object');
		assert(typeof line.json == 'object');
		assert(line.elapsedMs.chad >= delayMs);
		assert(line.elapsedMs.ALL >= line.elapsedMs.chad);
		//console.log('DONE', logs);
	})
});


describe('with expesss node server', function(){
	var app = express();
	var server;
	var delayMs = 420; // should be less than 800 or else mocha times out.
	
	// setup custom logger for profile_time to log to a file
	function myLogger(data) {
		data += data.match(/\n$/) ? '':'\n'; // add newline if there isn't one.
		fs.appendFileSync(logfn, data);
	}

	// startup node server
	before(function(done){
		
		profile_time.config({ logger: myLogger });
		
		app.use(profile_time.express); // will create req.profile_time
		
		app.get('/wait', function(req,res){
			myLogger('Server received request: '+ req.url);
			req.profile_time && req.profile_time.begin('wait');
			setTimeout(function(){
				req.profile_time && req.profile_time.end('wait');
				res.send('done.');
			}, delayMs);
		});
		
		server = app.listen(SERVER_LISTEN_PORT, function(){
			myLogger('Server started up on port '+ SERVER_LISTEN_PORT);
			done();
		});
	});

	it('should handle http requests', function(done) {
		// fire off request and close server
		var url = 'http://127.0.0.1:'+ SERVER_LISTEN_PORT + '/wait';
		//console.log('Request: '+ util.inspect(urlNode.parse(url)));
		
		http.request(url, function(res){
			res.on('end', function() {
				//console.log('Request got response: '+ url);
				server.close();
				done();
			});
		}).end();
	});

	it('should log to file', function(done) {
		var logLines = fs.readFileSync(logfn, 'utf8').split('\n');
		//console.log('logLines', util.inspect(logLines));

		for (var ii=0; ii<logLines.length; ii++) {
			var line = profile_time.parseLogLine(logLines[ii]);
			if (!line) {
				continue;
			}
			//console.log('logLines '+ ii, util.inspect(line));
			assert(typeof line == 'object');
			assert(typeof line.json == 'object');
			assert(line.elapsedMs.wait >= delayMs);
			assert(line.elapsedMs.ALL >= line.elapsedMs.wait);
			return done();
		}
		assert(false, 'No log lines could be parsed correctly')
	})
})

	
