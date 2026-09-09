const pokemonMetadataCache =
    require("../cache/pokemonMetadataCache");

// =========================================================
// NORMALIZE ARRAY
// =========================================================

function normalizeArray(value) {
    if (value === null || value === undefined) {
        return [];
    }

    if (Array.isArray(value)) {
        return value
            .map((item) =>
                String(item)
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean);
    }

    return String(value)
        .split(",")
        .map((item) =>
            item
                .trim()
                .toLowerCase()
        )
        .filter(Boolean);
}


// =========================================================
// NORMALIZE BOOLEAN
// =========================================================

function normalizeBoolean(value) {
    if (value === true || value === "true") {
        return true;
    }

    if (value === false || value === "false") {
        return false;
    }

    return null;
}


// =========================================================
// FILTER POKEMON
// =========================================================

async function filterPokemon(filters = {}) {

    const pokemonList =
        pokemonMetadataCache.getAll();

    console.log(
        `🔎 Filtering ${pokemonList.length} Pokémon`
    );

    console.log(
        "🔎 Filters:",
        filters
    );

    const result = [];


    // =====================================================
    // LOOP ALL POKEMON
    // =====================================================

    for (const metadata of pokemonList) {


        // =================================================
        // TYPE
        // =================================================

        const selectedTypes =
            normalizeArray(filters.type);

        if (selectedTypes.length > 0) {

            const matches =
                selectedTypes.every(
                    (type) =>
                        metadata.types?.includes(type)
                );

            if (!matches) {
                continue;
            }
        }


        // =================================================
        // GENERATION
        // =================================================

        if (
            filters.generation !== null &&
            filters.generation !== undefined
        ) {

            const requiredGeneration =
                Number(filters.generation);

            const pokemonGeneration =
                Number(metadata.generation);

            if (
                pokemonGeneration !==
                requiredGeneration
            ) {
                continue;
            }
        }


        // =================================================
        // LEGENDARY
        // =================================================

        const legendaryFilter =
            normalizeBoolean(
                filters.legendary
            );

        if (legendaryFilter !== null) {

            if (
                Boolean(metadata.legendary) !==
                legendaryFilter
            ) {
                continue;
            }
        }


        // =================================================
        // MYTHICAL
        // =================================================

        const mythicalFilter =
            normalizeBoolean(
                filters.mythical
            );

        if (mythicalFilter !== null) {

            if (
                Boolean(metadata.mythical) !==
                mythicalFilter
            ) {
                continue;
            }
        }


        // =================================================
        // HAS EVOLUTION
        // =================================================

        const hasEvolutionFilter =
            normalizeBoolean(
                filters.hasEvolution
            );

        if (hasEvolutionFilter !== null) {

            if (
                Boolean(metadata.hasEvolution) !==
                hasEvolutionFilter
            ) {
                continue;
            }
        }


        // =================================================
        // EVOLUTION FORMS
        // =================================================

        if (
            filters.evolutionForms !== null &&
            filters.evolutionForms !== undefined
        ) {

            const requiredForms =
                Number(filters.evolutionForms);

            const pokemonForms =
                Number(metadata.evolutionForms);

            if (
                pokemonForms !==
                requiredForms
            ) {
                continue;
            }
        }


        // =================================================
        // EFFECTIVE
        // =================================================

        const effectiveTypes =
            normalizeArray(
                filters.effective
            );

        if (effectiveTypes.length > 0) {

            const matches =
                effectiveTypes.every(
                    (type) =>
                        metadata.effectiveness
                            ?.[
                                type
                            ]
                            ?.category ===
                        "effective"
                );

            if (!matches) {
                continue;
            }
        }


        // =================================================
        // NO EFFECT
        // =================================================

        const noEffectTypes =
            normalizeArray(
                filters.noEffect
            );

        if (noEffectTypes.length > 0) {

            const matches =
                noEffectTypes.every(
                    (type) =>
                        metadata.effectiveness
                            ?.[
                                type
                            ]
                            ?.category ===
                        "no_effect"
                );

            if (!matches) {
                continue;
            }
        }


        // =================================================
        // NOT EFFECTIVE
        // =================================================

        const notEffectTypes =
            normalizeArray(
                filters.notEffect
            );

        if (notEffectTypes.length > 0) {

            const matches =
                notEffectTypes.every(
                    (type) =>
                        metadata.effectiveness
                            ?.[
                                type
                            ]
                            ?.category ===
                        "not_effective"
                );

            if (!matches) {
                continue;
            }
        }


        // =================================================
        // SUPER EFFECTIVE
        // =================================================

        const superEffectTypes =
            normalizeArray(
                filters.superEffect
            );

        if (superEffectTypes.length > 0) {

            const matches =
                superEffectTypes.every(
                    (type) =>
                        metadata.effectiveness
                            ?.[
                                type
                            ]
                            ?.category ===
                        "super_effective"
                );

            if (!matches) {
                continue;
            }
        }


        // =================================================
        // MATCH
        // =================================================

        result.push(metadata);
    }


    // =====================================================
    // DEBUG
    // =====================================================

    console.log(
        `✅ Filter result: ${result.length}/${pokemonList.length}`
    );


    if (result.length > 0) {

        console.log(
            "🟢 First results:",
            result.slice(0, 5).map(
                (pokemon) => ({
                    id: pokemon.id,
                    name: pokemon.name,
                    types: pokemon.types,
                    generation: pokemon.generation
                })
            )
        );

    }


    return result;
}


// =========================================================
// EXPORT
// =========================================================

module.exports = {
    filterPokemon
};