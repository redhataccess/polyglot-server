/* globals define */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery', 'moment'], factory);
    } else {
        // Browser globals
        root.Polyglot = factory(root.jQuery, root.moment);
    }
}(this, function($, moment) {
    var instance = null,
        FALLBACK_KEY = 'RHCP-_POLYGLOT',
        //STORAGE_KEY = 'RHCP-POLYGLOT',
        VALID_LANGS = ['en', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pt', 'ru', 'zh_CN'],
        POLYGLOT_SERVER = '//polyglot-etc.itos.redhat.com/',
        useRelative = (window.location.hostname.indexOf('redhat.com') > 0),
        hasStorage = ('localStorage' in window && window.localStorage !== null);

    /**
     * normalizes requested language.
     * 1) if a language wasn't provided it will look in the window.portal
     * object. If there isn't a window.portal object we will return english
     * 2) ensures it is a valid language
     * @param  {String} lang
     * @return {String} normalized language
     */
    var _normalizeLang = function(lang) {
            if (!lang && window.portal && window.portal.lang) {
                lang = window.portal.lang;
            }
            if (!lang) {
                return 'en';
            }
            var validLang = false,
                i;
            for (i = 0; i < VALID_LANGS.length; i++) {
                // poor man's Array.indexOf
                if (lang === VALID_LANGS[i]) {
                    validLang = true;
                    break;
                }
            }
            if (!validLang) {
                // I don't know what you gave me. Here is english.
                return 'en';
            }
            return lang;
        },
        _searchForRegExp = function(haystack, needle, obj) {
            var x;
            for (x in haystack) {
                // 'query' the object in localStorage using the regex
                if (needle.test(x)) {
                    obj[x] = haystack[x];
                }
            }
        },
        _objKeys = function(obj) {
            if (Object.keys) {
                return Object.keys(obj);
            }
            // poor man's Object.keys
            var result = [],
                prop;
            for (prop in obj) {
                if (obj.hasOwnProperty(obj, prop)) {
                    result.push(prop);
                }
            }
        },
        _sortKeys = function(keys) {
            // string -> array -> sort -> string
            return keys.split(',').sort().join(',');
        },
        _escape = function(text) {
            return text.replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },
        _parseProperties = function(properties) {
            var lines = properties.split('\n'),
                parsed = {
                    en: {}
                },
                i;
            for (i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (!line || line.indexOf('#') === 0) {
                    continue;
                }
                var item = line.split('=');
                var key = item.shift();
                var value = item.join('=');
                parsed.en[key] = value;
            }
            return parsed;
        },
        _safeStore = function(key, value) {
            if (!hasStorage) {
                // :'(
                return false;
            }
            if (typeof value === 'undefined') {
                // return value
                return window.localStorage.getItem(key);
            }
            // set value
            return window.localStorage.setItem(key, value);
        };

    var Polyglot = function() {
        if (useRelative) {
            // Use relative path if we are in *.redhat.com
            POLYGLOT_SERVER = '/etc/polyglot/';
        }
        // init object of already called deferreds
        this._fetchDfds = {};
        // the vals we have so far
        this._vals = {};
        // prepare for the worst
        this._initFallback();
    };

    /**
     * fetch provided keys from the polyglot server
     * @param  {string} keys String of comma separated keys
     * @param  {string} lang The desired language
     * @return {Promise}
     */
    Polyglot.prototype.t = function(keys, lang, version) {
        lang = _normalizeLang(lang);
        keys = _sortKeys(keys);
        var hash = lang + '_' + keys;
        if (version) {
            hash += ('_' + version);
        }
        if (!this._fetchDfds[hash]) {
            this._fetchDfds[hash] = this._fetch(keys, lang, version);
        }
        return this._fetchDfds[hash];
    };

    Polyglot.prototype._fetch = function(keys, lang, version) {
        var dfd = new $.Deferred(),
            self = this,
            queryData = {
                keys: keys,
                lang: lang
            };
        if (version) {
            queryData.version = version;
        }

        $.getJSON(POLYGLOT_SERVER, queryData)
            .done(function(data) {
                var keys = _objKeys(data),
                    prop;

                for (var i = 0; i < keys.length; i++) {
                    lang = keys[i];
                    if (typeof self._vals[lang] === 'undefined') {
                        self._vals[lang] = {};
                    }
                    // Mixin returned vals to local vals
                    for (prop in data[lang]) {
                        self._vals[lang][prop] = data[lang][prop];
                    }
                }
                dfd.resolve(data);
            })
            .fail(function() {
                self._fallback(keys, lang, dfd);
            });
        return dfd.promise();
    };

    Polyglot.prototype._fallback = function(keys, lang, dfd) {
        var fallback = _safeStore(FALLBACK_KEY);
        if (!fallback) {
            console.error('Couldn\'t fallback!');
            this._getRaw(dfd);
            return;
        }
        lang = _normalizeLang(lang);
        fallback = JSON.parse(fallback);
        fallback = fallback[lang];
        keys = keys.split(',');
        var obj = {};
        obj[lang] = {};
        var endsWithStar = /\*$/;
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (endsWithStar.test(key)) {
                _searchForRegExp(fallback, new RegExp(key), obj[lang]);
                continue;
            }
            if (fallback[key]) {
                obj[lang][key] = fallback[key];
            }
        }
        dfd.resolve(obj);
    };

    Polyglot.prototype._getRaw = function(dfd) {
        // This is the absolute worst case scenario.
        // Chances are, polyglot is down and we are
        // going to parse the raw messages.properties file
        // Wish us luck.
        $.get('/webassets/avalon/j/messages/messages.properties')
            .done(function(response) {
                dfd.resolve(_parseProperties(response));
            })
            .fail(function() {
                dfd.reject();
            });
    };

    Polyglot.prototype._initFallback = function() {
        var hasFallback = _safeStore(FALLBACK_KEY);
        if (hasFallback) {
            var now = moment().utc();
            var fallback = JSON.parse(hasFallback);
            if (now.isBefore(moment(fallback.expires, 'YYYYMMDD').utc())) {
                return;
            }
        }
        // fetch all keys and all lang and jam them in localStorage
        this._fetch('.*', '.*').then(function(vals) {
            if (vals) {
                var now = moment().utc();
                vals.expires = now.add(1, 'week').format('YYYYMMDD');
                _safeStore(FALLBACK_KEY, JSON.stringify(vals));
            }
        });
    };

    /**
     * Get the Polyglot singleton, or create one if it doesn't exist
     * @return {Polyglot} Polyglot an Polyglot instance
     */
    Polyglot.getInstance = function() {
        if (instance === null) {
            instance = new Polyglot();
        }
        return instance;
    };

    return Polyglot.getInstance();
}));
