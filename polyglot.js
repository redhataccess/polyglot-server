/* globals define */

define('polyglot', ['jquery'], function($) {
    var instance = null,
        FALLBACK_KEY = 'RHCP-_POLYGLOT',
        STORAGE_KEY = 'RHCP-POLYGLOT',
        VALID_LANGS = ['en', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pt', 'ru', 'zh_CN'],
        POLYGLOT_SERVER = '//polyglot-redhataccess.itos.redhat.com/',
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
            var validLang = false;
            for (var i = 0; i < VALID_LANGS.length; i++) {
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
        _sortKeys = function(keys) {
            // string -> array -> sort -> string
            return keys.split(',').sort().join(',');
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
    Polyglot.prototype.t = function(keys, lang) {
        lang = _normalizeLang(lang);
        keys = _sortKeys(keys);
        var hash = lang + '_' + keys;
        if (!this._fetchDfds[hash]) {
            this._fetchDfds[hash] = this._fetch(keys, lang);
        }
        return this._fetchDfds[hash];
    };

    Polyglot.prototype._fetch = function(keys, lang) {
        var dfd = new $.Deferred(),
            self = this;
        $.get(POLYGLOT_SERVER, {
            keys: keys,
            lang: lang
        }).done(function(data) {
            if (typeof self._vals[lang] === 'undefined') {
                self._vals[lang] = data[lang];
            }
            dfd.resolve(data[lang]);
        }).fail(function() {
            dfd.resolve(self._fallback(keys));
        });
        return dfd.promise();
    };

    Polyglot.prototype._fallback = function(keys) {
        var fallback = _safeStore(FALLBACK_KEY);
        if (!fallback) {
            console.error('Couldn\'t fallback!');
            return;
        }
        fallback = JSON.parse(fallback);
        keys = keys.split(',');
        var obj = {};
        var endsWithStar = /\*$/;
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (endsWithStar.test(key)) {
                _searchForRegExp(fallback, new RegExp(key), obj);
                continue;
            }
            if (fallback[key]) {
                obj[key] = fallback[key];
            }
        }
        return obj;
    };

    Polyglot.prototype._initFallback = function() {
        var hasFallback = _safeStore(FALLBACK_KEY);
        if (hasFallback) {
            return;
        }
        this._fetch('\\\\*', 'en').then(function(vals) {
            if (vals) {
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
});
