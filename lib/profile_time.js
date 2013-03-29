exports = module.exports = (function (){
	var options = {
		// don't log requests that take less than min4Log ms, for skipping static files.
		min4Log: process.env.BOT_PROFILER_MIN4LOG || 10,
		// options.logDone can be used to write own log lines
		logger: console.log
	};

	/**
	 * Sets a few options for profiler 'class', can also set options in object (see Profiler)
	 */
	function config(opts){
		var k;
		if (typeof opts != 'object') {
			console.warn('config called with non-object, skipping:', opts);
		}
		for (k in opts) {
			options[k] = opts[k];
		}
		return options;
	}
	
	/**
	 * Intiates profiler in express context, creates req.profile_time object 
	 * @method express
	 */
	function express(req, res, next){
		//options.logger('req.profile_time initializing..', req && req.url);
		if (req.profile_time) {
			return next();
		}
		req.profile_time = Profiler(req.url);

		// hook into response output API so we can log data
		var end = res.end;
		res.end = function(chunk, encoding){
			res.end = end;
			req.profile_time.done();
			res.end(chunk, encoding);
		};
		next();
	}

	/**
	 * Simple profiler, used to track time measurements and log when done
	 * Also has methods for processing and totalling measurements.
	 *
	 * @class Profiler
	 * @constructor
	 * @param  {String}  [url=""] optional url to be logged with request timing info.
	 * @param  {Object}  [options] optional config options
	 * @return {Object}  own object
	 */
	var Profiler = function (url, userOptions) {
		if ( !(this instanceof Profiler) ) {
			return new Profiler( url, userOptions );
		}
		// first handle case where options is passed, but url is not. EX: Profiler(options)
		if (typeof url == 'object') {
			userOptions = url;
			url = undefined;
		}
		this.url = url || '<url>';
		this.options = options;
		if (typeof userOptions == 'object') {
			for (k in userOptions) {
				this.options[k] = userOptions[k];
			}
		}
		this.startMs = new Date().getTime();
		this.times = {};
		this.elapsedMs = {};
		this.linesSeen = 0;
		
		this.begin('ALL');
		return this;
	}


	/**
	 * Add a timestamp at this point with key as its name
	 * @class Profiler
	 * @method add
	 * @param  {String}  [key=""]  Name used in log, for reference
	 * @return {Object}  own object so methods can be chained
	 */
	Profiler.prototype.add = function(key) {
		var now = new Date().getTime();
		if (key in this.elapsedMs) {
			if (typeof this.elapsedMs[key] == 'number') {
				// make it an array of numbers
				this.elapsedMs[key] = [this.elapsedMs[key]];
				this.times[key] = [this.times[key]];
			}
			this.times[key].push(now);
			this.elapsedMs[key].push(now - this.startMs);
		} else {
			this.times[key] = now;
			this.elapsedMs[key] = now - this.startMs;
		}
		return this;
	}
	/**
	 * Add a timestamp at this point with key as its name, to be used with end
	 * @class Profiler
	 * @method begin
	 * @param  {String}  [key=""]  Name used in log, for reference
	 * @return {Object}  own object so methods can be chained
	 */
	Profiler.prototype.begin = function(key) {
		return this.add('b:' + key);
	}
	/**
	 * Add a timestamp at this point with key as its name, to be used with begin
	 * @class Profiler
	 * @method end
	 * @param  {String}  [key=""]  Name used in log, for reference
	 * @return {Object}  own object so methods can be chained
	 */
	Profiler.prototype.end = function(key) {
		return this.add('e:' + key);
	}

	/**
	 * Called when done timing.  Adds a final "Done" key and calls logDone to write log.
	 * When used with express, this is called automatically.
	 * @class Profiler
	 * @method done
	 * @return {Object}  own object so methods can be chained
	 */
	Profiler.prototype.done = function() {
		var now = new Date().getTime();
		if (this.options.min4Log > (now - this.startMs)) {
			return;
		}
		this.end('ALL');
		this.logDone();
		return this;
	}
		
	/**
	 * Writes timing info to log.
	 * @class Profiler
	 * @method logDone
	 * @return {Object}  own object so methods can be chained
	 */
	Profiler.prototype.logDone = function() {
		if (typeof this.options.logDone == 'function') {
			this.options.logDone(this);
		} else {
			var date = (new Date(this.startMs)).toJSON(); // ex: 2013-03-23T14:20:07.330Z
			this.options.logger(date +' profile_time '+ this.url +' '+ JSON.stringify(this.elapsedMs));
		}
		return this;
	}
	
	
	/**
	 * Parses timing info from one line of logs. If log does not match, it is skipped.
	 * @class Profiler
	 * @method parseLogLine
	 * @param  {String}  [logLine=""]  log line to parse
	 * @return {Object}  object containing parsed log information
	 */
	Profiler.prototype.parseLogLine = function(logLine) {
		this.linesSeen++;
		//console.log('parseLogLine:', logLine);
		// must match log in logDone()
		var matches = logLine.match(/(\S+) (_profiler|profile_time) (\S+) (.*)\s*?$/);
		if (!(matches && matches[2])) {
			return null;
		}
		var line = {
			start: matches[1],
			url: matches[3],
			elapsedMs: {},
			json: null,
			jsonString: matches[4] || ''
		}
		try {
			line.json = JSON.parse(line.jsonString);
			for (var key in line.json) {
				matches = key.match(/^e:(.*)$/i);
				if (matches) {
					line.elapsedMs[matches[1]] = line.json[key] - line.json['b:'+matches[1]]
				}
			}
		} catch (e) {
			console.warn('Could not parse JSON string: "'+ line.jsonString +'"');
		}
		//console.log('parseLogLine DONE:', [line]);
		return line;
	}



	/**
	 * Adds log line info to a "total" object
	 * @class Profiler
	 * @method addLineToTotal
	 * @param  {String|Object} log line to total
	 * @param  {Object}        total object
	 * @return {Object}        updated total object
	 */
	Profiler.prototype.addLineToTotal = function(line, total) {
		var key = '';
		var depthRemaining = this.options.urls;
		var total = total || this.total || {};
		var matches, tmp;

		if (typeof line === 'string') {
			// assume its log line not yet parsed
			line = this.parseLogLine(line);
		}
		if (!(line && line.json)) {
			//console.log('no match:', line.toString() );
			return;
		}
		if (!total.first) {
			total.first = line.start;
		}
		total.last = line.start;
		add2Key(total, 'totalParsedLines', 1);
		total.totalLines   = total.totalLines || {};
		total.totalTime    = total.totalTime || {};

		if (this.options.urls) {
			matches = line.url.split('/');
			// fix case where /a/b?c should be split into 'a', 'b', '?c'
			if (matches[matches.length-1].match(/.+?\?/)) {
				tmp = matches[matches.length-1].match(/^(.+)?(\?.*)$/);
				matches[matches.length-1] = tmp[1];
				matches[matches.length] = tmp[2];
			}
			for (var m=0; depthRemaining && typeof matches[m] != 'undefined'; m++) {
				//console.log('xxxxx m='+m, depthRemaining && typeof matches[m] != 'undefined', depthRemaining, typeof matches[m] != 'undefined');
				if (!matches[m]) {
					continue; // only count if we have chars between slashes
				}
				depthRemaining--;
				key += '/' + matches[m];
			}
			//console.log('url key: ', key);
			add2Key(total.totalTime, 'ALL', line.json.Done || line.json['e:ALL']);
			add2Key(total.totalTime,  key,  line.json.Done || line.json['e:ALL']);
			add2Key(total.totalLines, 'ALL', 1);
			add2Key(total.totalLines, key, 1);
		} else {
			for (key in line.elapsedMs) {
				add2Key(total.totalLines, key, 1);
				add2Key(total.totalTime, key, line.elapsedMs[key]);
			}
		}
		//console.log('addLineToTotal DONE:', [total]);
		return this.total = total;
	}


	/**
	 * Summarizes total, creating averageTime, percentTime, and percentLines
	 * @class Profiler
	 * @method summarizeTotal
	 * @param  {Object}        total object
	 * @return {Object}        updated total object
	 */
	Profiler.prototype.summarizeTotal = function() {
		var topKeys, topKeysLength;
		if (!(this.total && this.total.totalParsedLines)) {
			console.log('No matching lines out of ' + this.linesSeen +' lines seen.');
			return {};
		} 
		this.total.averageTime  = {};
		this.total.percentTime  = {};
		this.total.percentLines = {};

		if (this.options.topLines) {
			topKeysLength = this.options.topLines;
			topKeys = this.sortObjByValue(this.total.totalLines);

		} else if (this.options.topTime) {
			topKeysLength = this.options.topTime;
			topKeys = this.sortObjByValue(this.total.totalTime);

		} else if (this.options.topAvgTime) {
			topKeysLength = this.options.topAvgTime;
			this.computeAvgPercent();
			topKeys = this.sortObjByValue(this.total.averageTime);
		}

		if (topKeys) {
			if (!this.options.bottom) {
				topKeys.reverse();
			}
			// add 1 since 'ALL' topKey will always be there.
			topKeys.splice(1 + parseInt(topKeysLength), topKeys.length);
			console.log("topKeys:",topKeysLength, topKeys.length);
			
			if (!in_array('ALL', topKeys)) {
				// replace least 'top' one with 'ALL'
				topKeys.splice(-1, 1, 'ALL');
			}
			console.log("topKeys:",topKeys, topKeys.length);
			this.total.totalLines = removeAllButTop(this.total.totalLines, topKeys);
			this.total.totalTime  = removeAllButTop(this.total.totalTime,  topKeys);
		}
		if (this.options.topAvgTime) {
			// clear previous computeAvgPercent, so can redo with only topKeys
			this.total.averageTime  = {};
			this.total.percentTime  = {};
			this.total.percentLines = {};
		}

		this.computeAvgPercent();

		return this.total;
	}

	/**
	 * Summarizes total, creating averageTime, percentTime, and percentLines
	 * @class Profiler
	 * @method summarizeTotal
	 * @param  {Object}        total object
	 * @return {Object}        updated total object
	 */
	Profiler.prototype.computeAvgPercent = function() {
		var total = this.total;
		for (key in total.totalLines) {
			total.percentLines[key] = this.percent(total.totalLines[key] / total.totalParsedLines);
		}
		if (total.totalTime.ALL) {
			for (key in total.totalTime) {
				total.percentTime[key] = this.percent(total.totalTime[key] / total.totalTime.ALL);
				total.averageTime[key] = Math.round(total.totalTime[key] / total.totalLines[key]);
			}
		}
		return this.total = total;
	}


	/**
	 * format number into percent in a standard way
	 * @class Profiler
	 * @method percent
	 * @param  {Number}        number
	 * @return {Number}        number formatted as percent with one decimal place
	 */
	Profiler.prototype.percent = function(n) {
		if (n < 0.01) {
			return Math.round(10000 * n) / 100;
		}
		return Math.round(1000 * n) / 10;
	}

	/**
	 * Adds value to key in object, creating that key as number if it does not exist.
	 * @method add2Key
	 * @param  {Object}        any object
	 * @param  {Number}        amount to add to object[key]
	 */
	Profiler.prototype.sortObjByValue = function(obj) {
		var sortable = [];
		for (var key in obj) {
			sortable.push([key, obj[key]])
		}
		sortable.sort(function(a, b) {return a[1] - b[1]});
		return sortable.map(function(val){
			return val[0];
		});

	}

	/**
	 * Adds value to key in object, creating that key as number if it does not exist.
	 * @method add2Key
	 * @param  {Object}        any object
	 * @param  {String}        key in object
	 * @param  {Number}        amount to add to object[key]
	 */
	function add2Key(obj, key, val) {
		if (!(key in obj)) {
			obj[key] = 0;
		}
		if (typeof val === 'number') {
			obj[key] += val;
		}
	}

	function removeAllButTop(obj, topArray) {
		var newObj = { OTHER: 0 };
		for (key in obj) {
			if (in_array(key,topArray)) {
				newObj[key] = obj[key];
			} else {
				newObj.OTHER += obj[key];
			}
		}
		//console.log('removeAllButTop', newObj, topArray);
		return newObj;
	}

	function in_array(needle, haystack) {
		for (var key in haystack) {
			if (needle === haystack[key]) {
				return true;
			}
		}
		return false;
	}

	// module.exports
	return {
		Profiler: Profiler,
		config: config,
		express: express
	}
})();

