var express = require('express');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var errorhandler = require('errorhandler');
var compression = require('compression');

require('./lib/db');

var app = express();

// all environments
app.set('ip', process.env.OPENSHIFT_NODEDIY_IP || '127.0.0.1');
app.set('port', process.env.OPENSHIFT_NODEDIY_PORT || 3000);
app.use(bodyParser.json());
app.use(compression());

// development only
if ('development' === app.get('env')) {
    app.use(errorhandler());
    app.use(morgan('dev'));
} else {
    morgan.format('combined+', ':remote-addr - :remote-user [:date] ":method :url" :status :response-time ms - :res[content-length] ":referrer" ":user-agent"');
    app.use(morgan('combined+'));
}

var message = require('./resources/message.js');
app.post('/', message.fetch);
app.get('/', message.fetch);

app.get('/mu-1b945553-c98a6c01-6302bbe8-c751dcf8', function(req, res) {
    res.set({
        'Edge-control': 'max-age=10m'
    });
    res.send('42');
});

app.all('/*', function(req, res) {
    res.redirect('https://access.redhat.com/home');
});

app.listen(app.get('port'), app.get('ip'));
