require("dotenv").config();
const allowedOrigins = [
    "http://localhost:5173",
    "https://guess-my-pokemon.vercel.app"
];
const express = require("express");
const http = require("http");
const cors = require("cors");

const { Server } = require("socket.io");
const setupGameSocket = require("./socket/gameSocket");
const setupChatSocket = require("./socket/chatSocket");

const pokemonRoutes = require("./routes/pokemonRoutes");
const pokemonService = require("./services/pokemonService");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

setupGameSocket(io);
setupChatSocket(io);

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true
    })
);
app.use(express.json());

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

app.use("/api/pokemon", pokemonRoutes);

// ================================
// START SERVER
// ================================

async function startServer() {

    try {

        await pokemonService.preloadPokemonMetadata();

        server.listen(PORT, () => {

            console.log("=================================");
            console.log("Pokemon Guess Backend");
            console.log("=================================");
            console.log(`Server: http://localhost:${PORT}`);
            console.log(`Health: http://localhost:${PORT}/api/health`);
            console.log("Socket.IO: Enabled");
            console.log("=================================");

        });

    } catch (error) {

        console.error("Failed to start server:", error);
        process.exit(1);

    }

}

startServer();