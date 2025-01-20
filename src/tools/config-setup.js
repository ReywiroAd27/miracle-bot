"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require('fs');
const path = require('path');
function Config(cPath = __dirname + "config.json", bPath = __dirname + "/cache.conf") {
    if (!(this instanceof Config))
        throw new TypeError("Class constructor Config cannot be invoked without 'new'");
    if (typeof cPath !== "string")
        throw new TypeError("argument 'cPath' must be of type string");
    if (typeof bPath !== "string")
        throw new TypeError("argument 'bPath' must be of type string");
    this.__cPath = cPath;
    this.__bPath = bPath;
    this.apply();
}
Config.prototype = Object.defineProperties(Config.prototype, {
    __cPath: {
        value: "",
        writable: true,
    },
    __bPath: {
        value: "",
        writable: true,
    },
    __patterns: {
        value: {},
        writable: true
    },
    __config: {
        value: {},
        writable: true
    },
    generatePatterns: {
        value: generatePatterns,
    },
    loadCache: {
        value: loadCache,
    },
    saveCache: {
        value: saveCache,
    },
    apply: {
        value: function () {
            this.loadCache();
            this.loadConfig();
            this.saveCache();
        }
    },
    get: {
        value: function (key) {
            if (key == undefined)
                throw new ReferenceError("required argument 'key'");
            if (typeof key !== "string")
                throw new TypeError("argument 'key' must be of type string");
            for (const pattern of Object.values(this.__patterns)) {
                if (pattern.includes(key)) {
                    for (const [key, val] of Object.entries(this.__config)) {
                        if (pattern.includes(key)) {
                            return val;
                        }
                    }
                    return;
                }
            }
            return;
        },
        enumerable: true
    },
    getAll: {
        value: function () {
            return this.__config;
        },
        enumerable: true
    },
    set: {
        value: function (key, value) {
            if (key == undefined)
                throw new ReferenceError("required argument 'key'");
            if (typeof key !== "string")
                throw new TypeError("argument 'key' must be of type string");
            if (value == undefined)
                throw new ReferenceError("required argument 'value'");
            if (typeof value !== "string")
                throw new TypeError("argument 'value' must be of type string/number/boolean/array");
            if (!Object.values(this.__patterns).flatMap(val => val).includes(key)) {
                this.__patterns[key] = this.generatePatterns(key);
                this.__config[key] = value;
                this.saveCache();
                return;
            }
            for (const v of Object.values(this.__patterns).flatMap(a => a)) {
                if (v.includes(key)) {
                    for (const key of Object.keys(this.__config)) {
                        if (v.includes(key)) {
                            this.__config[key] = value;
                            return;
                        }
                    }
                    return;
                }
            }
        },
        enumerable: true
    },
    delete: {
        value: function (key) {
            if (key == undefined)
                throw new ReferenceError("required argument 'key'");
            if (typeof key !== "string")
                throw new TypeError("argument 'key' must be of type string");
            for (const [k, v] of Object.entries(this.__patterns)) {
                delete this.__patterns[k];
                if (v.includes(key)) {
                    for (const key of Object.keys(this.__config)) {
                        if (v.includes(key)) {
                            delete this.__config[key];
                            return;
                        }
                    }
                    return;
                }
            }
        },
        enumerable: true
    },
    deleteAll: {
        value: function () {
            delete this.__patterns;
            delete this.__config;
            return true;
        },
        enumerable: true
    }
});
// Membuat semua kombinasi pola keyword
// Generate all combination patterns words
function generatePatterns(key) {
    const baseWords = key.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ');
    const allPatterns = new Set();
    const defined = Object.values(this.__patterns).flatMap(val => val);
    // Generate patterns for different separators
    generateCombinations(baseWords, '', allPatterns);
    generateCombinations(baseWords, ' ', allPatterns);
    generateCombinations(baseWords, '-', allPatterns);
    generateCombinations(baseWords, '_', allPatterns);
    return Array.from(allPatterns).filter(item => !defined.includes(item));
}
function permutations(words) {
    return words.map(word => [word.toLowerCase(), word[0].toUpperCase() + word.slice(1).toLowerCase(), word.toUpperCase()]);
}
;
function combinations(arr, separator, store, prefix = '') {
    if (arr.length === 0) {
        store instanceof Set ? store.add(prefix) : store.push(prefix);
        return;
    }
    arr[0].forEach((word) => combinations(arr.slice(1), separator, store, prefix ? `${prefix}${separator}${word}` : word));
}
;
function generateCombinations(words, separator, store) {
    combinations(permutations(words), separator, store);
}
;
// load and save the configuration caches
// Memuat cache dari file binary
function loadCache() {
    if (fs.existsSync(this.__bPath)) {
        const buffer = fs.readFileSync(this.__bPath);
        const cacheData = JSON.parse(buffer.toString());
        this.__patterns = cacheData.patterns || {};
    }
}
// Menyimpan cache ke file binary
function saveCache() {
    const cacheData = JSON.stringify({ patterns: this.__patterns });
    if (!fs.existsSync(this.__bPath)) {
        const stream = fs.createWriteStream(this.__bPath);
        stream.write(cacheData);
        stream.end();
        return;
    }
    fs.writeFileSync(this.__bPath, cacheData);
}
// Reading and processing the configuration
function loadConfig() {
    if (!fs.existsSync(this.__cPath))
        return;
    const conf = JSON.parse(fs.readFileSync(this.__cPath, 'utf-8')), cache = Object.values(this.__patterns).flatMap(val => val);
    for (const key in conf) {
        if (!(this.patterns[key] || cache.includes(key))) {
            this.patterns[key] = this.generatePatterns(key);
        }
        this.__config[key] = conf[key];
    }
}
function main() {
    // File paths
    const cPath = path.resolve(__dirname, 'config.json');
    const bPath = path.resolve(__dirname, 'assets/cache.conf');
    // Inisialisasi Config
    global.config = new Config(cPath, bPath);
    global.config.apply();
    // Debugging
    if (process.argv.includes("--debug")) {
        console.log('Loaded Config:', global.config.getAll());
    }
}
module.exports = main;
