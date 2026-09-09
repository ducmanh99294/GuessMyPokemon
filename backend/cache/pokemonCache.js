const cache = new Map();

function get(name) {
    return cache.get(name.toLowerCase());
}

function set(name, data) {
    cache.set(name.toLowerCase(), data);
}

function has(name) {
    return cache.has(name.toLowerCase());
}

function clear() {
    cache.clear();
}

function size() {
    return cache.size;
}

function getAll() {
    return Array.from(cache.values());
}

module.exports = {
    get,
    set,
    has,
    clear,
    size,
    getAll
};