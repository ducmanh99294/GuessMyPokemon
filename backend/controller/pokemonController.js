const pokemonService = require("../services/pokemonService");
const pokemonFilterService = require("../services/pokemonFilterService");
async function getPokemon(req, res) {
    try {
        const { name } = req.params;

        const pokemon = await pokemonService.getPokemon(name);

        res.json({
            success: true,
            data: pokemon
        });

    } catch (error) {
        res.status(404).json({
            success: false,
            message: error.message
        });
    }
}

async function filterPokemon(req, res) {

    try {

        const filters = req.query;

        const result =
            await pokemonFilterService.filterPokemon(filters);

        res.json({
            success: true,
            count: result.length,
            data: result
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
}

module.exports = {
    getPokemon,
    filterPokemon
};