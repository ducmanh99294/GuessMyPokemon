const BASE_URL = "https://pokeapi.co/api/v2";

async function getPokemon(name) {
    const response = await fetch(
        `${BASE_URL}/pokemon/${name.toLowerCase()}`
    );

    if (!response.ok) {
        throw new Error(`Pokemon "${name}" not found`);
    }

    return await response.json();
}

async function getPokemonList(limit = 10000) {
    const response = await fetch(
        `${BASE_URL}/pokemon?limit=${limit}&offset=0`
    );

    if (!response.ok) {
        throw new Error("Failed to get Pokemon list");
    }

    return await response.json();
}

async function getPokemonSpecies(name) {
    const response = await fetch(
        `${BASE_URL}/pokemon-species/${name.toLowerCase()}`
    );

    if (!response.ok) {
        throw new Error(`Species "${name}" not found`);
    }

    return await response.json();
}

async function getEvolutionChain(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Evolution chain not found");
    }

    return await response.json();
}

module.exports = {
    getPokemon,
    getPokemonSpecies,
    getEvolutionChain,
    getPokemonList
};
