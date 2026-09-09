const express = require("express");
const router = express.Router();

const pokemonController = require("../controller/pokemonController");

router.get(
    "/filter",
    pokemonController.filterPokemon
);

router.get("/:name", pokemonController.getPokemon);

module.exports = router;