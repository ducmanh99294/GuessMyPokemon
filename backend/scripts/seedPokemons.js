// =====================================================
// Seed Pokemon metadata into MongoDB — RUN ONCE ONLY
// (or re-run any time; safe because it uses upsert).
//
//   cd D:\Render\guessMyPokemon\backend
//   node scripts/seedPokemons.js
//
// Requires: MONGODB_URI in the .env file.
// Flow: preloadPokemonMetadata() will see the "pokemons" collection
// empty -> download from PokeAPI (batches of 20, takes a few minutes) ->
// upsert everything into MongoDB. On later runs, if data
// already exists the script exits immediately.
// =====================================================

const path = require("path");

// Load .env: try the current directory, fall back to backend/.env
require("dotenv").config();
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const {
    connectMongo,
    closeMongo,
    isMongoReady,
} = require("../db/mongo");
const { preloadPokemonMetadata } = require("../services/pokemonService");

(async () => {
    console.log("[seed] Connecting to MongoDB...");

    await connectMongo();

    if (!isMongoReady()) {
        console.error(
            "[seed] MONGODB_URI is not set or the connection failed."
        );
        console.error(
            "[seed] Add MONGODB_URI to backend/.env and run again."
        );
        process.exit(1);
    }

    console.log("[seed] Starting Pokemon metadata seed...");
    console.log(
        "[seed] First run downloads from PokeAPI (~1000+ Pokemon, takes a few minutes)."
    );

    await preloadPokemonMetadata();

    await closeMongo();

    console.log("[seed] Done. From now on the server reads from MongoDB.");
    process.exit(0);
})().catch((error) => {
    console.error("[seed] Error:", error);
    process.exit(1);
});
