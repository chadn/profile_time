profile_time
============

A simple javascript profiler designed to work with node and express, 
especially helpful with cloud solutions like heroku.

In node + express environment, it simply tracks the start and end times of an express request,
allowing additional triggers to be added in between.
All triggers, start, and end times are logged when response is sent.

Where this shines is in the processing of these logs. 
By reading all logs generated over many hours or days (and from multiple sources), 
times can be summed up and total time spent between triggers can be known.
This is useful when trying to ballpark where most of node app time is spent.

For example, if 2 triggers were added, one before and one after a chunk of code,
the total time spent in that chunk of code can be known. And more importantly,
that time as percent of the total time is known, so it is possible to know how
much time is actually being spent by a chunk of code before it is optimized.

## Test and Example Logs

Have a look at `test/profile_time.test.js` for example on how to use.

Run `npm test` to generate sample `test/test.server.log`.  
You might need to run `npm install --dev` for tests.
Looks like this:

	% cat test/test.server.log
	Server started up on port 3000
	Server received request: /wait/420
	2013-03-26T22:42:02.676Z profile_time /wait/420 {"b:ALL":0,"b:wait":0,"e:wait":420,"e:ALL":421}
	Server received request: /wait/180
	2013-03-26T22:42:03.100Z profile_time /wait/180 {"b:ALL":0,"b:wait":0,"e:wait":179,"e:ALL":180}

And analysis by `bin/parse_logs.js` reveals something like this:

	% bin/parse_logs.js test/test.server.log
	{ first: '2013-03-26T22:42:02.676Z',
	  last: '2013-03-26T22:42:03.100Z',
	  totalParsedLines: 2,
	  totalLines: { wait: 2, ALL: 2 },
	  totalTime: { wait: 599, ALL: 601 },
	  averageTime: { wait: 300, ALL: 301 },
	  percentTime: { wait: 99.7, ALL: 100 },
	  percentLines: { wait: 100, ALL: 100 } }
	Done


## Usage with node + express

profile_time was created to work easily within the express framework, part of node.js.

First, install

	npm install profile_time

Second, add setup code

	var profile_time = require('profile_time');
	var express  = require('express');
	var app = express();
	app.use(profile_time.express); // will create req.profile_time

Lastly, insert req.profile_time.add() in your routes, like this
	
	app.get('/category/:catg', function(req,res){
		...
		req.profile_time && req.profile_time.add('category.jade');
		res.render('category.jade', data);
	});


## Usage with heroku + papertrail

Included is an example script to analyze log files, called parse_logs.js
Feel free to copy and modify it for your needs. Basically you'll need to match the strings
used in your req.profile_time.add(string).

Examples:

	parse_logs.js logfile.txt
	heroku logs -n 1500  | ./parse_logs.js

Note that sometimes heroku logs inserts a newline char in the middle of a log line,
which can prevent correct parsing.  These occasional data points get skipped.

I personally use it with heroku and the papertrail addon, to scan all log lines from the previous day.
With papertrail, you can get the last 7 days of archived log files, for free (10MB max per day).

	% gzip -dc ~/download/2013-03-24.gz | ./bin/parse_logs.js 
	{ first: '2013-03-24T00:00:00.375Z',
	  last: '2013-03-24T23:59:58.836Z',
	  totalParsedLines: 29046,
	  totalLines: 
	   { ALL: 29046,
	     'category.jade': 14054,
	     'product.jade': 7073,
	     'product/detail.jade': 78 },
	  totalTime: 
	   { ALL: 17454705,
	     'category.jade': 6816973,
	     'product.jade': 3346311,
	     'product/detail.jade': 2045 },
	  averageTime: 
	   { ALL: 601,
	     'category.jade': 485,
	     'product.jade': 473,
	     'product/detail.jade': 26 },
	  percentTime: 
	   { ALL: 100,
	     'category.jade': 39.1,
	     'product.jade': 19.2,
	     'product/detail.jade': 0 },
	  percentLines: 
	   { ALL: 100,
	     'category.jade': 48.4,
	     'product.jade': 24.4,
	     'product/detail.jade': 0.3 } }
	Done


## Usage in a browser

This could be used in a browser but sending times to something like [stathat](http://www.stathat.com/docs/api)
is much more effective. Requires [free stathat account](https://www.stathat.com//).

	var startMs = new Date().getTime();
	// long code here
	var elapsedMs = new Date().getTime() - startMs;
	$.ajax({url: 'http://api.stathat.com/ez?email=xx&stat=longcode+avg&value='+elapsMs});


## Other profilers

If using heroku, newrelic is also one of my favorites.  Definitely try them out for profiling and monitoring.

A list of [several node profilers](http://mindon.github.com/blog/2012/04/26/profiling-nodejs-application/).




