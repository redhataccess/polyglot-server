var mongoose = require('mongoose');

// Connect to mongo
var mongoURL = 'mongodb://127.0.0.1/polyglot';

if (process.env.OPENSHIFT_MONGODB_DB_URL) {
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL + process.env.OPENSHIFT_APP_NAME;
}
mongoose.connect(mongoURL);

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback() {
    console.info('mongoose connection is open');
});

mongoose.model('Message', new mongoose.Schema({
    'key': { type: [String], index: true },
    'value': String,
    'lang': { type: [String], index: true }
}));
