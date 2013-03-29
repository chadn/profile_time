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

var fs = require('fs');
var lazy = require('lazy');
var profile_time = require('../lib/profile_time');
var myProfiler = profile_time.Profiler();

function init() {
	if (process.argv.length > 2) {
		readLazy(fs.createReadStream(process.argv[2]));
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
	myProfiler.addLineToTotal(p);
}

function summarize(){
	console.log(myProfiler.summarizeTotal());
	console.log('Done');
}

init();
