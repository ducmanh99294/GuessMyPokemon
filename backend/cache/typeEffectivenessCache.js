const cache = new Map();

function get(key) {
    return cache.get(key);
}

function set(key, data) {
    cache.set(key, data);
}

function has(key) {
    return cache.has(key);
}

function clear() {
    cache.clear();
}

function size() {
    return cache.size;
}

module.exports = {
    get,
    set,
    has,
    clear,
    size
};