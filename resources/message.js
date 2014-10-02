var mongoose = require('mongoose');
var Message = mongoose.model('Message');
var crypto = require('crypto');
var cache = require('memory-cache');
var exec = require('child_process').exec;
var _ = require('lodash-node');

var hydrateRegexes = function($in) {
    var endsWithStar = /\*$/;
    for (var i = 0; i < $in.length; i++) {
        if (endsWithStar.test($in[i])) {
            $in[i] = new RegExp($in[i]);
        }
    }
};

var formatResults = function(results) {
    var flatten = function(value) {
        var obj = {};
        obj[value.key] = value.value;
        return obj;
    };
    results = _.groupBy(results, 'lang');

    for (var lang in results) {
        results[lang] = _.map(results[lang], flatten);
    }
    return results;
};

exports.fetch = function(req, res) {
    var cacheHeaders = {
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Date': new Date(Date.now()).toUTCString(),
        'Expires': new Date(Date.now() + 3600000).toUTCString()
    };
    var lang = 'en',
        keys;
    if (req._body) {
        if (Array.isArray(req.body)) {
            keys = req.body;
        } else {
            lang = req.body.lang;
            keys = req.body.keys;
        }
    } else {
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
    if (cachedData && req.get('Cache-Control') !== 'no-cache') {
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
            res.send(messages);
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
