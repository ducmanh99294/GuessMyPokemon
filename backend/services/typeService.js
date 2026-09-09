const BASE_URL = "https://pokeapi.co/api/v2";

const typeCache = new Map();

async function getType(name) {
    name = name.toLowerCase();

    // Kiểm tra cache
    if (typeCache.has(name)) {
        return typeCache.get(name);
    }

    const response = await fetch(
        `${BASE_URL}/type/${name}`
    );

    if (!response.ok) {
        throw new Error(`Type "${name}" not found`);
    }

    const data = await response.json();

    const result = {
        name: data.name,

        doubleDamageTo: data.damage_relations.double_damage_to
            .map((type) => type.name),

        halfDamageTo: data.damage_relations.half_damage_to
            .map((type) => type.name),

        noDamageTo: data.damage_relations.no_damage_to
            .map((type) => type.name)
    };

    // Lưu cache
    typeCache.set(name, result);

    return result;
}

module.exports = {
    getType
};