var redis = require('redis');

var client = null;
if (process.env.OPENSHIFT_REDIS_HOST) {
    client = redis.createClient(process.env.OPENSHIFT_REDIS_PORT, process.env.OPENSHIFT_REDIS_HOST);
} else {
    client = redis.createClient();
}

module.exports = client;
