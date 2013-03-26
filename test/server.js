
var express      = require('express');
var profile_time = require('../lib/profile_time');
var fs           = require('fs');

var SERVER_LISTEN_PORT = 3000;

var logfn = __dirname + '/profile_time.node.log';
fs.writeFileSync(logfn, ''); // truncate any existing file

// setup profile_time to log to a file
function myLogger(data) {
	data += data.match(/\n$/) ? '':'\n'; // add newline if there isn't one.
	fs.appendFileSync(logfn, data);
}
profile_time.config({ logger: myLogger });

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
myLogger('Startup on port '+ SERVER_LISTEN_PORT);

