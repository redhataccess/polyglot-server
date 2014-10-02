var mongoose = require('mongoose');
var Message = mongoose.model('Message');
var crypto = require('crypto');
var cache = require('memory-cache');
var exec = require('child_process').exec;

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
        lang: lang,
        key: {
            $in: keys
        }
    };
    // Sorting to ensure requests with different order will give same hash.
    query.key.$in.sort();
    var reqHash = crypto.createHash('md5').update(JSON.stringify(query)).digest('hex');
    var cachedData = cache.get(reqHash);
    if (cachedData) {
        res.set(cacheHeaders);
        return res.send(cachedData);
    }
    var endsWithStar = /\*$/;
    for (var i = 0; i < query.key.$in.length; i++) {
        if (endsWithStar.test(query.key.$in[i])) {
            query.key.$in[i] = new RegExp(query.key.$in[i]);
        }
    }

    Message.find(query, '-_id', function(err, data) {
        if (err) {
            res.send(err);
        } else {
            cache.put(reqHash, data);
            res.set(cacheHeaders);
            res.send(data);
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
