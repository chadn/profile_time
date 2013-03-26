exports = module.exports = (function (){
	var options = {
		// don't log requests that take less than min4Log ms, for skipping static files.
		min4Log: process.env.BOT_PROFILER_MIN4LOG || 10,
		// options.logDone can be used to write own log lines
		logger: console.log
	};

	/**
	 * Sets a few options for profiler
	 */
	function config(opts){
		var k;
		if (typeof opts != 'object') {
			console.warn('config called with non-object, skipping:', opts);
		}
		for (k in opts) {
			options[k] = opts[k];
		}
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
	 *
	 * @class Profiler
	 * @constructor
	 * @param  {String}  [url=""] optional url to be logged with request timing info.
	 * @return {Object}  own object
	 */
	var Profiler = function (url) {
		if ( !(this instanceof Profiler) ) {
			return new Profiler( url );
		}
		this.url = url || '<url>';
		this.startMs = new Date().getTime();
		this.times = {};
		this.elapsedMs = {};
		
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
		if (options.min4Log > (now - this.startMs)) {
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
		if (typeof options.logDone == 'function') {
			options.logDone(this);
		} else {
			var date = (new Date(this.startMs)).toJSON(); // ex: 2013-03-23T14:20:07.330Z
			options.logger(date +' profile_time '+ this.url +' '+ JSON.stringify(this.elapsedMs));
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
		// must match log in logDone()
		var matches = logLine.match(/(\S+) profile_time (\S+) (.*)\s*?$/);
		if (!(matches && matches[2])) {
			return null;
		}
		var line = {
			start: matches[1],
			url: matches[2],
			elapsedMs: {},
			json: null,
			jsonString: matches[3] || ''
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
		return line;
	}

	// module.exports
	return {
		Profiler: Profiler,
		config: config,
		parseLogLine: Profiler.prototype.parseLogLine,
		express: express
	}
})();
