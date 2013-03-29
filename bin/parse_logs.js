#!/usr/bin/env node
/*
 *  parse_logs.js
 * 
 *  Example cmd-line javascript that parses profile_time log lines from a node server.
 *  This focuses on figuring out how much time is spent in rendering jade templates.
 *  Examples:
 *
 *  parse_logs.js logFile.txt
 *
 *  gzip -dc 2013-03-24.gz | ./parse_logs.js
 *
 *  heroku logs -n 1500  | ./parse_logs.js
 */

var lazy         = require('lazy');
var program      = require('commander');
var fs           = require('fs');
var profile_time = require('../lib/profile_time');
var myProfiler;

function help() {
  console.log('  Description:');
  console.log('');
  console.log('  Displays stats based on profile_time log lines, including total, percent, and average times.');
  console.log('  By default, it looks only at the json data string, including any begin/end key data.');
  console.log('  If url option is passed (-u), the total time for each url is processed instead.');
  console.log('');
  console.log('  Examples:');
  console.log('');
  console.log('    $ cat file.log | parse_logs.js');
  console.log('    $ cat file.log | parse_logs.js -u 2');
  console.log('    $ parse_logs.js -l file.log');
  console.log('    $ parse_logs.js -u 1 -l file.log');
  console.log('');
}
function init() {
	program
		.version('0.0.2')
		.option('-l, --logfile [file.log]', 'parse file.log, not stdin. Looks to stdin if no logfile')
		.option('-u, --url [n]', 'Display stats from url instead of from json key data.\n'
		   + 'Group urls by at most depth n, where depth is number of slashes: /1/2/3')
		//.option('-t, --top [n]', 'only show stats for the top [n] values')
		//.option('-v, --verbose', 'be verbose in output')
		.on('--help', help)
		.parse(process.argv);

	myProfiler   = profile_time.Profiler({ 
		//topValues : program.top,
		urls : program.url
	});
	//process.stdout.write(program.helpInformation());
	
	if (program.logfile) {
		readLazy( fs.createReadStream(program.logfile) );
	} else {
		process.stdin.resume();
		process.stdin.setEncoding('utf8');
		readLazy(process.stdin);
	}
}
function readLazy(stream) {
	new lazy(stream)
	.on('end', summarize)
	.lines
	.forEach(processLine);
}

function processLine(line) {
	var p = myProfiler.parseLogLine(line.toString());
	if (!(p && p.json)) {
		return;
	}

	// add custom times to p.elapsedMs so they can be summarized
	if (!p.elapsedMs.ALL) {
		p.elapsedMs.ALL = p.json.Done - p.json.start;
	}
	for (key in p.json) {
		if (key.match(/\.jade/i)) {
			p.elapsedMs[key] = (p.json.Done || p.json['e:ALL']) - p.json[key];
		}
		//todo botApi.getProducts start
	}
	/*
	if (p.url.match(/^\/category\//)) {
		t.total.linesCatg++;
	}
	if (p.url.match(/^\/product\//)) {
		t.total.linesProd++;
	}
	*/
	//console.log('processLine DONE:', [p]);
	myProfiler.addLineToTotal(p);
}

function summarize(){
	console.log(myProfiler.summarizeTotal());
	console.log('Done');
}

init();
