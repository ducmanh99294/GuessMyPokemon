const pokeApiService = require("./pokeApiService");

let pokemonIndex = null;

async function getPokemonIndex() {

    if (pokemonIndex) {
        console.log("Pokemon index cache hit");
        return pokemonIndex;
    }

    console.log("Loading Pokemon index...");

    const data = await pokeApiService.getPokemonList();

    pokemonIndex = data.results.map((pokemon, index) => ({
        id: index + 1,
        name: pokemon.name
    }));

    console.log(
        `Loaded ${pokemonIndex.length} Pokemon`
    );

    return pokemonIndex;
}

module.exports = {
    getPokemonIndex
};