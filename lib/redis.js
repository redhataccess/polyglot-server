var redis = require('redis');

var client = null;
if (process.env.OPENSHIFT_REDIS_HOST) {
    client = redis.createClient(process.env.OPENSHIFT_REDIS_PORT, process.env.OPENSHIFT_REDIS_HOST);
    client.auth(process.env.REDIS_PASSWORD, function() {});
} else if (process.env.OPENSHIFT_REDIS_DB_HOST) {
    client = redis.createClient(process.env.OPENSHIFT_REDIS_DB_PORT, process.env.OPENSHIFT_REDIS_DB_HOST);
    client.auth(process.env.OPENSHIFT_REDIS_DB_PASSWORD, function() {});
} else {
    client = redis.createClient();
}

module.exports = client;
