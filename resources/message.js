var mongoose = require('mongoose');
var Message = mongoose.model('Message');
var cache = require('memory-cache');
var exec = require('child_process').exec;
var _ = require('lodash-node');

var ONE_HOUR_SEC = (60 * 60),
    ONE_HOUR_MS = (ONE_HOUR_SEC * 1000),
    ONE_MONTH_SEC = (60 * 60 * 24 * 30),
    ONE_MONTH_MS = (ONE_MONTH_SEC * 1000);

var hydrateRegexes = function($in) {
    var endsWithStar = /\*$/;
    for (var i = 0; i < $in.length; i++) {
        if (endsWithStar.test($in[i])) {
            try {
                $in[i] = new RegExp($in[i]);
            } catch (e) {
                console.error(e);
            }
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

var addCorsHeaders = function(req, res) {
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        // IE does not respond unless there is a p3p header... even though it really
        // doesn't do anything here
        'p3p': 'CP="This is not a P3P policy!"'
    });
};

var addCacheHeaders = function(req, res, cacheHit) {
    var cc = ONE_HOUR_SEC,
        expires = ONE_HOUR_MS;

    if (req.query && req.query.v) {
        // Much longer cache if version was provided
        cc = ONE_MONTH_SEC;
        expires = ONE_MONTH_MS;
    }
    res.set({
        'Cache-Control': 'public, max-age=' + cc,
        'Date': new Date(Date.now()).toUTCString(),
        'Expires': new Date(Date.now() + expires).toUTCString()
    });
    res.set('X-Cache', cacheHit ? 'HIT' : 'MISS');
};

exports.fetch = function(req, res) {
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
        lang = decodeURIComponent(req.query.lang || lang);
        keys = decodeURIComponent(req.query.keys);
        pretty = (req.query.pretty === 'true');
        lang = req.query.lang || lang;
        keys = (req.query.keys && req.query.keys.split(',')) || [];

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
    query.lang.$in.sort();
    var queryStr = JSON.stringify(query);
    var cachedData = cache.get(queryStr);
    if (cachedData && req.get('Cache-Control') !== 'no-cache' && !pretty) {
        addCorsHeaders(req, res);
        addCacheHeaders(req, res, true);
        setTimeout(function () {
            res.jsonp(cachedData);
        }, 1000);
        return;
    }
    hydrateRegexes(query.key.$in);
    hydrateRegexes(query.lang.$in);


    Message.find(query, '-_id').lean().exec(function(err, messages) {
        if (err) {
            res.send(err);
        } else {
            messages = formatResults(messages);
            addCorsHeaders(req, res);
            addCacheHeaders(req, res, false);
            if (pretty) {
                res.set('Content-Type', 'application/json; charset=utf-8');
                res.send(JSON.stringify(messages, undefined, '\t'));
            } else {
                res.jsonp(messages);
            }
            cache.put(queryStr, messages);
        }
    });
};
