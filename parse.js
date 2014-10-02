#!/usr/bin/env node

'use strict';

var properties = require('properties');
var glob = require('glob');
require('./lib/db');
var Q = require('q');
var cache = require('memory-cache');

var Message = require('mongoose').model('Message');

var messages = [],
    deferredList = [];

function storeMessages() {
    Message.collection.remove({}, function(err) {
        if (err) {
            return console.log('Error dropping collection?');
        }
        Message.collection.insert(messages, function(err, docs) {
            if (err) {
                console.log('Error saving docs?');
                process.exit(1);
                return;
            }
            console.log('Collection saved!');
            cache.clear();
            process.exit(0);
        });
    });
}

function parseFile(file, lang) {
    var deferred = Q.defer();
    properties.parse(file, {
        path: true
    }, function(err, obj) {
        if (err) {
            return console.error(err);
        }
        var m;
        for (m in obj) {
            messages.push({
                key: m,
                value: obj[m],
                lang: lang
            });
        }
        deferred.resolve();
    });
    return deferred.promise;
}
var DATA_DIR = (process.env.OPENSHIFT_DATA_DIR ? (process.env.OPENSHIFT_DATA_DIR) : './') + 'messages/';

glob(DATA_DIR + '**/*.properties', function(err, files) {
    if (err) {
        return console.error(err);
    }
    var langRegEx = /\.\/messages_(\w{2,5})/;
    files.forEach(function(file) {
        var lang = 'en';
        var matches = file.match(langRegEx);
        if (matches && matches.length) {
            lang = matches[1];
        }
        deferredList.push(parseFile(file, lang));
    });
    Q.all(deferredList).then(storeMessages);
});
