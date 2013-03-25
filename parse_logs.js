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
var profile_time = require('./profile_time');

var startMs = new Date().getTime();
var t = { 
	percent: {},
	total: {
		timeDone: 0,
		timeJade: 0, // time spent rendering jade
		timeCatgJade: 0,
		linesCatgJade: 0,
		linesJade: 0,
		linesProd: 0,
		linesCatg: 0,
		lines: 0
	}
};

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
	var p = profile_time.parseLogLine(line.toString());
	if (!(p && p.json && p.json.Done)) {
		//console.log('no match:', line.toString() );
		return;
	}
	if (!t.first) {
		t.first = p.start;
	}
	t.last = p.start;
	t.total.lines++;
	t.total.timeDone += p.json.Done;
	for (key in p.json) {
		if (key.match(/\.jade/i)) {
			t.total.linesJade++;
			t.total.timeJade += p.json.Done - p.json[key];
		}
		if (key.match(/category.jade/i)) {
			t.total.linesCatgJade++;
			t.total.timeCatgJade += p.json.Done - p.json[key];
		}
	}
	if (p.url.match(/^\/category\//)) {
		t.total.linesCatg++;
	}
	if (p.url.match(/^\/product\//)) {
		t.total.linesProd++;
	}
}
function summarize(){
	if (t.total.timeDone) {
		t.percent.timeJade = percent(t.total.timeJade / t.total.timeDone);
		t.percent.timeCatgJade = percent(t.total.timeCatgJade / t.total.timeDone);
		t.percent.linesCatgJade = percent(t.total.linesCatgJade / t.total.lines);
		t.percent.linesCatg = percent(t.total.linesCatg / t.total.lines);
		t.percent.linesProd = percent(t.total.linesProd / t.total.lines);
		console.log(t);
		console.log('Done');
	} else {
		console.log('No matching lines');
	}
	
}
function percent(n) {
	return Math.round(1000 * n) / 10;
}


init();
