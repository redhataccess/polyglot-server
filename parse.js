#!/usr/bin/env node

'use strict';

var properties = require('properties');
var glob = require('glob');
require('./lib/db');
var Q = require('q');
var cache = require('memory-cache');
var args = require('minimist')(process.argv.slice(2));
var env = args.env || 'master';

var Message = require('mongoose').model('Message');

var messages = [],
    englishObj = {},
    englishDfd = Q.defer(),
    deferredList = [];

function storeMessages() {
    // Would like to use upsert, but hard to do in bulk
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
            // Nuke our cache.
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
        if (lang === 'en') {
            englishObj = obj;
        }
        var m;
        for (m in obj) {
            messages.push({
                key: m,
                // Fallback to english string if this language doesn't have it.
                // or an empty string in the worst case scenario
                value: obj[m] || englishObj[m] || '',
                lang: lang
            });
        }
        deferred.resolve();
    });
    return deferred.promise;
}
var DATA_DIR = (process.env.OPENSHIFT_DATA_DIR ? (process.env.OPENSHIFT_DATA_DIR) : './') + 'messages/';
// We are going to parse the english messages first so they can be used as fallbacks in other languages.
glob(DATA_DIR + '**/messages.properties', function(err, files) {
    if (err) {
        return console.error(err);
    }
    if (!files.length || files.length > 1) {
        console.error('Wut.');
        return;
    }
    parseFile(files[0], 'en').then(function() {
        englishDfd.resolve();
    });
});
englishDfd
    .promise
    .then(function() {
        // We have the english strings, now we can work through the other languages.
        glob(DATA_DIR + '**/*_*.properties', function(err, files) {
            if (err) {
                return console.error(err);
            }
            // regex to extract the lang from the file name
            // an example is `messages_fr.properties`
            var langRegEx = /\/messages_(\w{2,5})/;
            files.forEach(function(file) {
                var matches = file.match(langRegEx);
                if (matches && matches.length) {
                    // successful regex
                    deferredList.push(parseFile(file, matches[1]));
                }
            });
            // Wait until all messages have been parsed and then stuff them in the DB
            Q.all(deferredList).then(storeMessages);
        });
    });
