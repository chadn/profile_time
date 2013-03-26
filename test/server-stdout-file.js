
var express      = require('express');
var profile_time = require('../lib/profile_time');
var fs           = require('fs');

var SERVER_LISTEN_PORT = 3000;

// redirect console.log from stdout to log file
var logfn = __dirname + '/node.log';
var logFileStream = fs.createWriteStream(logfn, {flags: 'w'});
process.__defineGetter__('stdout', function() { return logFileStream });

var app = express();
app.use(profile_time.express); // will create req.profile_time
app.get('/timeout/:ms', function(req,res){
	var timeoutMs = req.params.ms || 500;
	req.profile_time && req.profile_time.begin('timeout');
	setTimeout(function(){
		req.profile_time && req.profile_time.end('timeout');
		//console.log('/timeout done');
		res.send('done after '+ timeoutMs + 'ms');
	}, timeoutMs);
});
app.listen(SERVER_LISTEN_PORT)
console.log('Startup on port '+ SERVER_LISTEN_PORT);

