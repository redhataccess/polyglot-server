var mongoose = require('mongoose');
var Message = mongoose.model('Message');
var crypto = require('crypto');
var cache = require('memory-cache');

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
