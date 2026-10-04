require("dotenv").config();

const allowedOrigins = [
    "http://localhost:5173",
    "https://guessmypokemon.vercel.app"
];

const express = require("express");
const http = require("http");
const cors = require("cors");

const { Server } = require("socket.io");

const setupGameSocket = require("./socket/gameSocket");
const setupChatSocket = require("./socket/chatSocket");
const setupSoloSocket = require("./socket/soloSocket");
const setupPvpSocket = require("./socket/pvpSocket");

const pokemonRoutes = require("./routes/pokemonRoutes");
const pokemonService = require("./services/pokemonService");
const { createLeaderboardRouter } = require("./routes/leaderboardRoutes");
const { connectMongo } = require("./db/mongo");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

// ================================
// SOCKET.IO
// ================================

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

setupGameSocket(io);
setupChatSocket(io);
setupSoloSocket(io);
setupPvpSocket(io);

// ================================
// MIDDLEWARE
// ================================

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true
    })
);

app.use(express.json());

// ================================
// HEALTH CHECK
// ================================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Pokemon Guess Backend is running!"
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        status: "OK"
    });
});

// ================================
// ROUTES
// ================================

app.use("/api/pokemon", pokemonRoutes);
app.use("/api/daily/leaderboard", createLeaderboardRouter("daily"));
app.use("/api/pvp/leaderboard", createLeaderboardRouter("pvp"));

// ================================
// START SERVER
// ================================

function startServer() {

    // IMPORTANT:
    // Open port immediately so Render can detect it.
    server.listen(PORT, "0.0.0.0", () => {

        console.log("=================================");
        console.log("Pokemon Guess Backend");
        console.log("=================================");
        console.log(`Server running on port ${PORT}`);
        console.log(`Health: /api/health`);
        console.log("Socket.IO: Enabled");
        console.log("=================================");

    });

    // Load Pokemon data AFTER server starts
    pokemonService
        .preloadPokemonMetadata()
        .then(() => {
        })
        .catch((error) => {
            console.error(
                "Failed to preload Pokemon metadata:",
                error
            );
        });
}

// Connect to MongoDB before opening the port.
// No MONGODB_URI or connection failed -> run in
// fallback mode (PokeAPI + local JSON files), the server still starts normally.
(async () => {

    try {
        await connectMongo();
    } catch (error) {
        console.error(
            "[mongo] Could not connect to MongoDB, running in fallback mode:",
            error.message
        );
    }

    startServer();

})();
