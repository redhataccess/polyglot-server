var mongoose = require('mongoose');
var Message = mongoose.model('Message');
var crypto = require('crypto');
var cache = require('memory-cache');
var exec = require('child_process').exec;
var _ = require('lodash-node');

var ONE_HOUR_SEC = 3600,
    ONE_HOUR_MS = ONE_HOUR_SEC * 1000;

var hydrateRegexes = function($in) {
    var endsWithStar = /\*$/;
    for (var i = 0; i < $in.length; i++) {
        if (endsWithStar.test($in[i])) {
            $in[i] = new RegExp($in[i]);
        }
    }
};

var formatResults = function(results) {
    results = _.groupBy(results, 'lang');

    for (var lang in results) {
        var langObj = {};
        _.forEach(results[lang], function(value) {
            langObj[value.key] = value.value;
        });
        results[lang] = langObj;
    }
    return results;
};

exports.fetch = function(req, res) {
    var cacheHeaders = {
        'Cache-Control': 'public, max-age=' + ONE_HOUR_SEC,
        'Access-Control-Allow-Origin': '*',
        'Date': new Date(Date.now()).toUTCString(),
        'Expires': new Date(Date.now() + ONE_HOUR_MS).toUTCString()
    };
    var lang = 'en',
        keys,
        pretty = false;
    if (req._body) {
        // RESPONDING TO POST
        if (Array.isArray(req.body)) {
            keys = req.body;
        } else {
            lang = req.body.lang;
            keys = req.body.keys;
            pretty = (req.body.pretty === 'true');
        }
    } else {
        // RESPONDING TO GET
        pretty = (req.query.pretty === 'true');
        lang = req.query.lang || lang;
        keys = req.query.keys.split(',');
    }
    var query = {
        lang: {
            $in: lang.split(',')
        },
        key: {
            $in: keys
        }
    };
    // Sorting to ensure requests with different order will give same hash.
    query.key.$in.sort();
    var reqHash = crypto.createHash('md5').update(JSON.stringify(query)).digest('hex');
    var cachedData = cache.get(reqHash);
    if (cachedData && req.get('Cache-Control') !== 'no-cache' && !pretty) {
        res.set(cacheHeaders);
        return res.send(cachedData);
    }
    hydrateRegexes(query.key.$in);
    hydrateRegexes(query.lang.$in);


    Message.find(query, '-_id').lean().exec(function(err, messages) {
        if (err) {
            res.send(err);
        } else {
            messages = formatResults(messages);
            cache.put(reqHash, messages);
            res.set(cacheHeaders);
            if (pretty) {
                res.set('Content-Type', 'application/json; charset=utf-8');
                res.send(JSON.stringify(messages, undefined, '\t'));
            } else {
                res.json(messages);
            }
        }
    });
};

exports.sync = function(req, res) {
    exec(__dirname + '/sync',
        function(error, stdout, stderr) {
            console.log('stdout: ' + stdout);
            console.log('stderr: ' + stderr);
            if (error !== null) {
                console.log('exec error: ' + error);
            }
        });
    res.json({
        'status': 'ok'
    });
};
