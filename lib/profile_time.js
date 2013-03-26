exports = module.exports = (function (){
	var min4Log = process.env.BOT_PROFILER_MIN4LOG || 100; // don't log requests that take less than min4Log ms.
	//console.log('_profiler loaded() min4Log='+ min4Log); // uncomment if you plan on tweaking BOT_PROFILER_MIN4LOG
	var options = {};

	/**
	 * Sets a few options for profiler
	 */
	function config(options){
		if (min4Log in options) {
			min4Log = options.min4Log;
		}
		// options.logDone can be used to write own log lines
	}
	
	/**
	 * Intiates profiler in express context, creates req.profile_time object 
	 * @method express
	 */
	function express(req, res, next){
		//console.log('req.profile_time initializing..', req && req.url);
		if (req.profile_time) {
			return next();
		}
		req.profile_time = Profiler(req.url);
		//console.log('req.profile_time initialized()', req.profile_time);

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
	 * Simple profiler, used to measure time between any points triggered by user
	 * Usage:
	 * <pre>
	 * var profile = new mpProfiler("Measuring async loop");
	 * </pre>
	 *
	 * @class Profiler
	 * @constructor
	 * @param  {String}  [url=""] optional url to be logged with request timing info.
	 */
	var Profiler = function (url) {
		if ( !(this instanceof Profiler) ) {
			return new Profiler( url );
		}
		this.url = url || '';
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
	}
	/**
	 * Add a timestamp at this point with key as its name, to be used with end
	 * @class Profiler
	 * @method begin
	 * @param  {String}  [key=""]  Name used in log, for reference
	 */
	Profiler.prototype.begin = function(key) {
		this.add('b:'+key);
	}
	/**
	 * Add a timestamp at this point with key as its name, to be used with begin
	 * @class Profiler
	 * @method end
	 * @param  {String}  [key=""]  Name used in log, for reference
	 */
	Profiler.prototype.end = function(key) {
		this.add('e:'+key);
	}

	/**
	 * Called when done timing.  Adds a final "Done" key and calls logDone to write log.
	 * When used with express, this is called automatically.
	 * @class Profiler
	 * @method done
	 */
	Profiler.prototype.done = function() {
		var now = new Date().getTime();
		if (min4Log > (now - this.startMs)) {
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
	 */
	Profiler.prototype.logDone = function() {
		if (typeof options.logDone == 'function') {
			options.logDone(this);
		} else {
			var date = (new Date(this.startMs)).toJSON(); // ex: 2013-03-23T14:20:07.330Z
			console.log(date +' _profiler '+ this.url +' '+ JSON.stringify(this.elapsedMs));
		}
	}
	
	
	/**
	 * Parses timing info from one line of logs. If log does not match, it is skipped.
	 * @class Profiler
	 * @method parseLogLine
	 * @param  {String}  [logLine=""]  log line to parse
	 */
	Profiler.prototype.parseLogLine = function(logLine) {
		// must match console.log in logDone()
		var matches = logLine.match(/(\S+) _profiler (\S+) (.*)\s*?$/);
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
			for (key in line.json) {
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

