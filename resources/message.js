var mongoose = require('mongoose');
var Message = mongoose.model('Message');
var crypto = require('crypto');
var cache = require('memory-cache');
var exec = require('child_process').exec;

exports.fetch = function(req, res) {
    if (!req.body) {
        return res.json({
            'message': 'no body provided'
        });
    }
    var query = {};
    if (Array.isArray(req.body)) {
        query.lang = 'en';
        query.key = {
            $in: req.body
        };
    } else {
        query.lang = req.body.lang;
        query.key = {
            $in: req.body.keys
        };
    }
    // Sorting to ensure requests with different order will give same hash.
    query.key.$in.sort();
    var reqHash = crypto.createHash('md5').update(JSON.stringify(query)).digest('hex');
    var cachedData = cache.get(reqHash);
    if (cachedData) {
        return res.send(cachedData);
    }

    Message.find(query, '-_id', function(err, data) {
        if (err) {
            res.send(err);
        } else {
            cache.put(reqHash, data);
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
