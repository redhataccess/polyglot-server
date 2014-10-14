#!/usr/bin/env node

'use strict';

var properties = require('properties');
var glob = require('glob');
require('./lib/db');
var Q = require('q');
var client = require('./lib/redis');
var Download = require('download');
var extend = require('util')._extend;

var Message = require('mongoose').model('Message');

var DATA_DIR = './messages/';

var messages = [],
    englishObj = {},
    englishDfd = Q.defer(),
    deferredList = [];

function storeMessages() {
    // Would like to use upsert, but hard to do in bulk
    Message.collection.remove({}, function(err) {
        if (err) {
            console.log('Error dropping collection?');
            process.exit(1);
            return;
        }
        Message.collection.insert(messages, function(err, docs) {
            if (err) {
                console.log('Error saving docs?');
                process.exit(1);
                return;
            }
            console.log('Collection saved!');
            // Nuke our cache.
            client.flushall([], function(){});
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
            console.error(err);
            process.exit(1);
            return;
        }
        if (lang === 'en') {
            englishObj = obj;
        } else {
            var engClone = extend({}, englishObj);
            obj = extend(engClone, obj);
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

function parseFiles() {
    // We are going to parse the english messages first so they can be used as fallbacks in other languages.
    glob(DATA_DIR + '**/messages.properties*', function(err, files) {
        if (err) {
            console.error(err);
            process.exit(1);
            return;
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
                    console.error(err);
                    process.exit(1);
                    return;
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
}

var DL_PATH = 'https://access.redhat.com/webassets/avalon/j/messages/';
var bust = ('?b=' + Date.now());
var download = new Download()
    .get(DL_PATH + 'messages.properties' + bust)
    .get(DL_PATH + 'messages_de.properties' + bust)
    .get(DL_PATH + 'messages_es.properties' + bust)
    .get(DL_PATH + 'messages_fr.properties' + bust)
    .get(DL_PATH + 'messages_it.properties' + bust)
    .get(DL_PATH + 'messages_ja.properties' + bust)
    .get(DL_PATH + 'messages_ko.properties' + bust)
    .get(DL_PATH + 'messages_pt.properties' + bust)
    .get(DL_PATH + 'messages_ru.properties' + bust)
    .get(DL_PATH + 'messages_zh_CN.properties' + bust)
    .rename(function (path) {
        path.extname = '.properties';
    })
    .dest(DATA_DIR);

download.run(function(err) {
    if (err) {
        throw err;
    }
    parseFiles();
});
