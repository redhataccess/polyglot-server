var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var errorhandler = require('errorhandler');
var fs = require('fs');
var busboy = require('connect-busboy');

require('./lib/db');

var app = express();

// all environments
app.set('ip', process.env.OPENSHIFT_NODEDIY_IP || '127.0.0.1');
app.set('port', process.env.OPENSHIFT_NODEDIY_PORT || 3000);
app.use(morgan('combined'));
app.use(bodyParser.json());
app.use(busboy());

// development only
if ('development' === app.get('env')) {
    app.use(errorhandler());
}

var message = require('./resources/message.js');
app.post('/', message.fetch);

var UPLOAD_PATH = process.env.OPENSHIFT_APP_UUID || '/upload';
var DATA_DIR = process.env.OPENSHIFT_DATA_DIR ? (process.env.OPENSHIFT_DATA_DIR + 'messages/') : '/messages/';
app.post(UPLOAD_PATH, function(req, res) {
    var fstream;
    req.pipe(req.busboy);
    req.busboy.on('file', function(fieldname, file, filename) {
        fstream = fs.createWriteStream(__dirname + DATA_DIR + filename);
        file.pipe(fstream);
        fstream.on('close', function() {
            res.json({
                'status': 'ok'
            });
        });
    });
});

app.get(UPLOAD_PATH, message.flush);

app.all('/*', function(req, res) {
    res.redirect('https://access.redhat.com/home');
});

app.listen(app.get('port'), app.get('ip'));
