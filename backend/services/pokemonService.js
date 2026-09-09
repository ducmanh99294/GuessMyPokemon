const pokeApiService = require("./pokeApiService");
const effectivenessService = require("./effectivenessService");

const pokemonCache =
    require("../cache/pokemonCache");

const pokemonMetadataCache =
    require("../cache/pokemonMetadataCache");

const typeEffectivenessCache =
    require("../cache/typeEffectivenessCache");


// =====================================================
// GET FULL POKEMON
// =====================================================

async function getPokemon(name) {

    // =========================
    // CACHE
    // =========================

    const cachedPokemon =
        pokemonCache.get(name);

    if (cachedPokemon) {

        console.log(
            `Cache hit: ${name}`
        );

        return cachedPokemon;
    }

    console.log(
        `Cache miss: ${name}`
    );


    // =========================
    // GET DATA FROM POKEAPI
    // =========================

    const data =
        await pokeApiService.getPokemon(name);

    const species =
        await pokeApiService.getPokemonSpecies(
            data.species.name
        );

    const evolution =
        await pokeApiService.getEvolutionChain(
            species.evolution_chain.url
        );


    // =========================
    // BASIC DATA
    // =========================

    const types =
        data.types.map(
            (type) => type.type.name
        );


    // =========================
    // TYPE EFFECTIVENESS CACHE
    // =========================

    const effectivenessKey =
        [...types]
            .sort()
            .join(",");

    let effectiveness =
        typeEffectivenessCache.get(
            effectivenessKey
        );

    if (!effectiveness) {

        effectiveness =
            await effectivenessService
                .getAllEffectiveness(types);

        typeEffectivenessCache.set(
            effectivenessKey,
            effectiveness
        );
    }


    // =========================
    // GENERATION
    // =========================

    const generation =
        getGenerationNumber(
            species.generation.name
        );

    const legendary =
        species.is_legendary === true;

    const mythical =
        species.is_mythical === true;


    // =========================
    // STATS
    // =========================

    const stats = {

        hp:
            getStat(
                data.stats,
                "hp"
            ),

        attack:
            getStat(
                data.stats,
                "attack"
            ),

        defense:
            getStat(
                data.stats,
                "defense"
            ),

        specialAttack:
            getStat(
                data.stats,
                "special-attack"
            ),

        specialDefense:
            getStat(
                data.stats,
                "special-defense"
            ),

        speed:
            getStat(
                data.stats,
                "speed"
            )
    };


    // =========================
    // EVOLUTION
    // =========================

    const evolutionChain =
        parseEvolutionChain(
            evolution
        );

    const evolutionInfo =
        evolutionChain.find(
            (pokemon) =>
                pokemon.name === data.name
        );


    // =========================
    // FINAL POKEMON DATA
    // =========================

    const pokemon = {

        id:
            data.id,

        name:
            data.name,

        types,

        generation,

        legendary,

        mythical,

        baby:
            species.is_baby === true,

        stats,

        height:
            data.height / 10,

        weight:
            data.weight / 10,

        abilities:
            data.abilities.map(
                (ability) =>
                    ability.ability.name
            ),

        evolution: {

            stage:
                evolutionInfo?.stage ?? 1,

            evolvesFrom:
                evolutionInfo?.evolvesFrom ?? null,

            evolvesTo:
                evolutionInfo?.evolvesTo ?? []

        },

        effectiveness,

        color:
            species.color?.name ?? null,

        shape:
            species.shape?.name ?? null,

        habitat:
            species.habitat?.name ?? null,

        sprite:
            data.sprites.front_default
    };


    // =========================
    // SAVE TO CACHE
    // =========================

    pokemonCache.set(
        name,
        pokemon
    );


    return pokemon;
}


// =====================================================
// GET STAT
// =====================================================

function getStat(
    stats,
    statName
) {

    const stat =
        stats.find(
            (item) =>
                item.stat.name === statName
        );

    return stat
        ? stat.base_stat
        : 0;
}


// =====================================================
// GENERATION
// =====================================================

function getGenerationNumber(
    generationName
) {

    const generationMap = {

        "generation-i": 1,

        "generation-ii": 2,

        "generation-iii": 3,

        "generation-iv": 4,

        "generation-v": 5,

        "generation-vi": 6,

        "generation-vii": 7,

        "generation-viii": 8,

        "generation-ix": 9
    };

    return (
        generationMap[generationName]
        ?? null
    );
}


// =====================================================
// PARSE EVOLUTION CHAIN
// =====================================================

function parseEvolutionChain(
    chain
) {

    const result = [];


    function traverse(
        node,
        stage,
        from = null
    ) {

        const pokemonName =
            node.species.name;


        result.push({

            name:
                pokemonName,

            stage,

            evolvesFrom:
                from,

            evolvesTo:
                node.evolves_to.map(
                    (evolution) =>
                        evolution.species.name
                )
        });


        for (
            const evolution
            of node.evolves_to
        ) {

            traverse(
                evolution,
                stage + 1,
                pokemonName
            );
        }
    }


    traverse(
        chain.chain,
        1
    );


    return result;
}


// =====================================================
// GET POKEMON METADATA
// =====================================================

async function getPokemonMetadata(
    name
) {

    // =========================
    // CACHE
    // =========================

    const cachedPokemon =
        pokemonMetadataCache.get(
            name
        );

    if (cachedPokemon) {

        console.log(
            `Metadata cache hit: ${name}`
        );

        return cachedPokemon;
    }

    console.log(
        `Metadata cache miss: ${name}`
    );


    // =========================
    // GET DATA FROM POKEAPI
    // =========================

    const data =
        await pokeApiService.getPokemon(
            name
        );

    const species =
        await pokeApiService.getPokemonSpecies(
            data.species.name
        );

    // =========================
    // TYPES
    // =========================

    const types =
        data.types.map(
            (type) =>
                type.type.name
        );


    // =========================
    // TYPE EFFECTIVENESS CACHE
    // =========================

    const effectivenessKey =
        [...types]
            .sort()
            .join(",");

    let effectiveness =
        typeEffectivenessCache.get(
            effectivenessKey
        );

    if (!effectiveness) {

        effectiveness =
            await effectivenessService
                .getAllEffectiveness(
                    types
                );

        typeEffectivenessCache.set(
            effectivenessKey,
            effectiveness
        );
    }

    // =========================
    // ELOVUTION
    // =========================
        const evolution =
        await pokeApiService.getEvolutionChain(
            species.evolution_chain.url
        );

    const evolutionChain =
        parseEvolutionChain(evolution);

    const evolutionForms =
        evolutionChain.length;

    const hasEvolution =
        evolutionForms > 1;

    // =========================
    // METADATA
    // =========================

    const metadata = {

        id:
            data.id,

        name:
            data.name,

        types,

        generation:
            getGenerationNumber(
                species.generation.name
            ),

        legendary:
            species.is_legendary === true,

        mythical:
            species.is_mythical === true,

        baby:
            species.is_baby === true,

        sprite:
            data.sprites.front_default,

        effectiveness,

        hasEvolution,

        evolutionForms 
    };


    // =========================
    // SAVE CACHE
    // =========================

    pokemonMetadataCache.set(
        name,
        metadata
    );


    return metadata;
}


// =====================================================
// PRELOAD POKEMON METADATA
// =====================================================

async function preloadPokemonMetadata() {

    console.log(
        "================================="
    );

    console.log(
        "Preloading Pokemon metadata..."
    );

    console.log(
        "================================="
    );


    const pokemonIndex =
        await require(
            "./pokemonIndexService"
        ).getPokemonIndex();


    const BATCH_SIZE = 20;

    let loaded = 0;


    for (
        let i = 0;
        i < pokemonIndex.length;
        i += BATCH_SIZE
    ) {

        const batch =
            pokemonIndex.slice(
                i,
                i + BATCH_SIZE
            );


        await Promise.all(

            batch.map(
                async (pokemon) => {

                    if (
                        pokemonMetadataCache
                            .has(pokemon.name)
                    ) {
                        return;
                    }


                    try {

                        await getPokemonMetadata(
                            pokemon.name
                        );

                        loaded++;

                    } catch (error) {

                        console.error(

                            `Failed to load ${pokemon.name}:`,

                            error.message

                        );
                    }
                }
            )
        );


        console.log(

            `Loaded ${Math.min(
                i + BATCH_SIZE,
                pokemonIndex.length
            )}/${pokemonIndex.length}`

        );
    }


    console.log(
        "================================="
    );

    console.log(
        "Metadata preload complete"
    );

    console.log(

        `Cache size: ${
            pokemonMetadataCache.size()
        }`

    );

    console.log(
        "================================="
    );
}


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    getPokemon,

    getPokemonMetadata,

    preloadPokemonMetadata
};