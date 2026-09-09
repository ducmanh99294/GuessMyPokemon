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

function getAll() {
    return Array.from(cache.values());
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
    getAll,
    clear,
    size
};