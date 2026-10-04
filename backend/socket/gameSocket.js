const roomManager = require("../managers/roomManager");
const gameManager = require("../managers/gameManager");
const leaderboard = require("../managers/leaderboard");
const userManager = require("../managers/userManager");
const { verifyToken } = require("../middleware/authMiddleware");

// Resolve { isGuest } from a login JWT.
// Missing/invalid/expired token -> guest (score always 0).
async function resolveAuth(authToken) {
    if (!authToken) {
        return { isGuest: true };
    }
    try {
        const decoded = verifyToken(authToken);
        const user = await userManager.findById(decoded.sub);
        if (user) {
            return { isGuest: false };
        }
    } catch {
        // invalid token -> guest
    }
    return { isGuest: true };
}

// Grace period: a disconnected player is treated as gone only if
// they don't reconnect within this time
const DISCONNECT_TIMEOUT_MS = 60 * 1000;

// Abandon scoring:
// - the remaining player still scores, but only 50% of a normal win
// - the leaver gets a -50 pts entry on the pvp leaderboard
const ABANDON_WIN_RATIO = 0.5;
const ABANDON_PENALTY = -50;

// "roomId:playerId" -> timeout handle
const disconnectTimers = new Map();

function timerKey(roomId, playerId) {
    return `${roomId}:${playerId}`;
}

function clearDisconnectTimer(roomId, playerId) {
    const key = timerKey(roomId, playerId);
    const handle = disconnectTimers.get(key);

    if (handle) {
        clearTimeout(handle);
        disconnectTimers.delete(key);
    }
}

// Write 1 PVP entry per player when a pvp game ends.
// Entry: mode="pvp", score = total game score, won = 1st place
// (forceWinnerId marks the winner when the game ends by abandonment).
async function recordPvpLeaderboard(room, scoreboard, forceWinnerId = null) {
    const players = scoreboard?.players || [];

    if (players.length === 0) {
        return;
    }

    const winnerId = players[0].id;
    const finishedAt = Date.now();

    await Promise.all(
        players.map((player) => {
            const opponents = players
                .filter((other) => other.id !== player.id)
                .map((other) => other.name);

            return leaderboard.addEntry({
                mode: "pvp",
                playerId: player.id,
                playerName: player.name,
                // Guests always show 0
                score: player.isGuest ? 0 : player.score,
                won: player.isGuest
                    ? false
                    : forceWinnerId
                      ? player.id === forceWinnerId
                      : player.id === winnerId && player.score > 0,
                guesses: player.guesses,
                cluesUsed: player.cluesUsed,
                opponentName: opponents.join(", ") || null,
                durationSeconds: Math.floor(
                    (finishedAt - (room.createdAt || finishedAt)) / 1000
                ),
            });
        })
    );
}

function setupGameSocket(io) {

    // =========================================
    // A player is gone for good (explicit leave, or
    // disconnect timeout without reconnecting).
    // - Game in progress:
    //     1 player left  -> they win ("game_finished")
    //     2+ players left -> game continues ("room_updated")
    // - Game not started yet:
    //     0-1 players left -> room closes ("room_closed", clients go home)
    //     2+ players left  -> lobby continues ("room_updated")
    // =========================================
    function resolvePlayerGone(roomId, playerId) {
        const room = roomManager.getRoom(roomId);

        if (!room) {
            return;
        }

        // Game already over — nothing to resolve
        if (room.status === "finished") {
            return;
        }

        const leaver =
            roomManager.getPlayer(roomId, playerId);

        const updatedRoom =
            roomManager.leaveRoom(roomId, playerId);

        // No players left -> room deleted
        if (!updatedRoom) {
            io.to(roomId).emit("room_closed");
            return;
        }

        const remaining = updatedRoom.players;

        if (updatedRoom.status === "playing") {
            if (remaining.length === 1) {
                // Last player standing wins — with a reduced bonus
                updatedRoom.status = "finished";

                const winner = remaining[0];

                // 50% of what a correct guess would pay right now
                // (guests always score 0 — no bonus)
                const elapsedSeconds = Math.floor(
                    (Date.now() - (winner.game.startTime || Date.now())) / 1000
                );

                const winBonus = winner.isGuest
                    ? 0
                    : Math.floor(
                        gameManager.calculateScore(
                            winner.game.cluesUsed || 0,
                            elapsedSeconds
                        ) * ABANDON_WIN_RATIO
                    );

                winner.score += winBonus;

                const scoreboard =
                    gameManager.getFinalResults(updatedRoom);

                scoreboard.reason = "opponent_left";
                scoreboard.abandonBonus = winBonus;
                scoreboard.abandonPenalty = ABANDON_PENALTY;

                io.to(roomId).emit(
                    "game_finished",
                    scoreboard
                );

                if (updatedRoom.mode === "pvp") {
                    recordPvpLeaderboard(
                        updatedRoom,
                        scoreboard,
                        winner.id
                    ).catch((error) => {
                        console.error(
                            "[pvp] leaderboard write failed:",
                            error.message
                        );
                    });

                    // Penalty entry for the leaver
                    // (guests always show 0 — no negative score)
                    if (leaver) {
                        leaderboard.addEntry({
                            mode: "pvp",
                            playerId: leaver.id,
                            playerName: leaver.name,
                            score: leaver.isGuest ? 0 : ABANDON_PENALTY,
                            won: false,
                            guesses: leaver.game.guesses || 0,
                            cluesUsed: leaver.game.cluesUsed || 0,
                            opponentName: winner.name,
                            durationSeconds: Math.floor(
                                (Date.now() - (updatedRoom.createdAt || Date.now())) / 1000
                            ),
                        }).catch((error) => {
                            console.error(
                                "[pvp] abandon penalty write failed:",
                                error.message
                            );
                        });
                    }
                }

                return;
            }

            io.to(roomId).emit(
                "room_updated",
                gameManager.getPublicRoomState(updatedRoom)
            );

            return;
        }

        // Game hasn't started yet
        if (remaining.length <= 1) {
            roomManager.deleteRoom(roomId);
            io.to(roomId).emit("room_closed");
            return;
        }

        io.to(roomId).emit(
            "room_updated",
            gameManager.getPublicRoomState(updatedRoom)
        );
    }

    io.on("connection", (socket) => {

        // =========================================
        // CREATE ROOM
        // =========================================

        socket.on(
            "create_room",
            async ({ playerId, name, mode = "private", authToken }, callback) => {

                try {
                    if (!playerId) {
                        throw new Error("Player ID is required");
                    }

                    socket.playerId = playerId; // ⭐ ADDED

                    const auth = await resolveAuth(authToken);

                    const room =
                        roomManager.createRoom(
                            {
                                id: playerId,
                                socketId: socket.id,
                                name: name || "Player",
                                isGuest: auth.isGuest
                            },
                            mode
                        );

                    socket.join(room.roomId);

                    callback?.({
                        success: true,
                        room: gameManager.getPublicRoomState(room)
                    });

                } catch (error) {
                    callback?.({
                        success: false,
                        message: error.message
                    });
                }
            }
        );

        // =========================================
        // JOIN ROOM
        // =========================================

        socket.on(
            "join_room",
            async ({ roomId, playerId, name, authToken }, callback) => {

                try {
                    if (!playerId) {
                        throw new Error("Player ID is required");
                    }

                    socket.playerId = playerId;

                    const normalizedRoomId =
                        String(roomId || "").trim().toUpperCase();

                    if (!normalizedRoomId) {
                        throw new Error("Room code is required");
                    }

                    const auth = await resolveAuth(authToken);

                    const room =
                        roomManager.joinRoom(
                            normalizedRoomId,
                            {
                                id: playerId,
                                socketId: socket.id,
                                name: name || "Player",
                                isGuest: auth.isGuest
                            }
                        );

                    socket.join(normalizedRoomId);

                    clearDisconnectTimer(normalizedRoomId, playerId);

                    socket.emit(
                        "chat_history",
                        roomManager.getChat(normalizedRoomId)
                    );
                    const publicRoom =
                        gameManager.getPublicRoomState(
                            room
                        );

                    io.to(normalizedRoomId).emit(
                        "room_updated",
                        publicRoom
                    );

                    callback?.({
                        success: true,
                        room: publicRoom
                    });

                } catch (error) {

                    callback?.({
                        success: false,
                        message: error.message
                    });

                }
            }
        );


        // =========================================
        // START GAME
        // =========================================

        socket.on(
            "start_game",
            ({ roomId }, callback) => {

                try {

                    const room =
                        roomManager.getRoom(roomId);

                    if (!room) {
                        throw new Error(
                            "Room not found"
                        );
                    }

                    if (room.hostId !== socket.playerId) {
                        throw new Error(
                            "Only the host can start the game"
                        );
                    }

                    gameManager.startGame(roomId);

                    const publicRoom =
                        gameManager.getPublicRoomState(room);

                    io.to(roomId).emit(
                        "game_choosing",
                        publicRoom
                    );

                    callback?.({
                        success: true
                    });

                } catch (error) {

                    console.error("start_game error:", error);

                    callback?.({
                        success: false,
                        message: error.message
                    });

                }
            }
        );

        // =========================================
        // SELECT POKEMON
        // =========================================

socket.on(
    "select_pokemon",
    ({ roomId, pokemonId }, callback) => {
        try {
            if (!roomId) {
                throw new Error("Room ID is required");
            }

            if (
                pokemonId === undefined ||
                pokemonId === null
            ) {
                throw new Error("Pokemon ID is required");
            }

            const result =
                gameManager.selectPokemon(
                    roomId,
                    socket.playerId,
                    pokemonId
                );

            const room = result.room;

            room.players.forEach((player) => {
            });

            io.to(roomId).emit(
                "player_pokemon_selected",
                {
                    playerId: socket.playerId
                }
            );

            io.to(roomId).emit(
                "room_updated",
                gameManager.getPublicRoomState(room)
            );

            const allSelected =
                gameManager.allPlayersSelected(room);

            if (allSelected) {
                gameManager.initializeGame(room);

                sendPrivateGameStates(
                    io,
                    room
                );
            }

            callback?.({
                success: true
            });
        } catch (error) {
            console.error(
                "select_pokemon error:",
                error
            );

            callback?.({
                success: false,
                message: error.message
            });
        }
    }
);

        // =========================================
        // LEAVE ROOM
        // =========================================

        socket.on("leave_room", ({ roomId, playerId }, callback) => {
            try {
                const updatedRoom = roomManager.getRoom(roomId);

                if (!updatedRoom) {
                    return callback?.({
                        success: false,
                        message: "Room not found"
                    });
                }

                const player = roomManager.getPlayer(roomId, playerId);

                if (!player) {
                    return callback?.({
                        success: false,
                        message: "Player not found in room"
                    });
                }

                socket.leave(roomId);
                clearDisconnectTimer(roomId, playerId);

                // Explicit leave resolves immediately:
                // win for the last one standing, or room closes
                resolvePlayerGone(roomId, playerId);

                callback?.({
                    success: true
                });

            } catch (error) {
                console.error("❌ leave_room error:", error);

                callback?.({
                    success: false,
                    message: error.message
                });
            }
        });


        // =========================================
        // DISCONNECT
        // =========================================

        socket.on(
            "disconnect",
            () => {

                const rooms =
                    roomManager.getAllRooms();

                for (const room of rooms) {

                    const player =
                        room.players.find(
                            player =>
                                player.socketId === socket.id
                        );

                    if (!player) {
                        continue;
                    }

                    player.connected = false;
                    player.disconnectAt = Date.now();
                    player.socketId = null;

                    const publicRoom = gameManager.getPublicRoomState(room);                    

                    io.to(room.roomId).emit(
                        "room_updated",
                        publicRoom
                    );

                    // Give them a grace period to reconnect before
                    // treating them as gone (win for the opponent /
                    // room closes if the game hasn't started)
                    clearDisconnectTimer(room.roomId, player.id);

                    disconnectTimers.set(
                        timerKey(room.roomId, player.id),
                        setTimeout(() => {
                            disconnectTimers.delete(
                                timerKey(room.roomId, player.id)
                            );

                            const currentRoom =
                                roomManager.getRoom(room.roomId);

                            const currentPlayer =
                                currentRoom &&
                                roomManager.getPlayer(
                                    room.roomId,
                                    player.id
                                );

                            // Reconnected in time -> nothing to do
                            if (
                                !currentRoom ||
                                !currentPlayer ||
                                currentPlayer.connected
                            ) {
                                return;
                            }

                            console.log(
                                `[room] ${player.name} (${player.id}) ` +
                                `did not reconnect in time -> resolving ${room.roomId}`
                            );

                            resolvePlayerGone(
                                room.roomId,
                                player.id
                            );
                        }, DISCONNECT_TIMEOUT_MS)
                    );
                }
            }
        );

        // =============================================
        // reconnect_room
        // =============================================

        socket.on(
            "reconnect_room",
            async ({ roomId, playerId, authToken }, callback) => {
                try {
                    const room =
                        roomManager.getRoom(roomId);

                    if (!room) {
                        throw new Error(
                            "Room no longer exists"
                        );
                    }

                    const player =
                        room.players.find(
                            player =>
                                player.id === playerId
                        );

                    if (!player) {
                        throw new Error(
                            "Player not found in room"
                        );
                    }

                    const auth = await resolveAuth(authToken);

                    socket.playerId = playerId;
                    player.socketId = socket.id;
                    player.connected = true;
                    player.disconnectAt = null;
                    player.isGuest = auth.isGuest;

                    clearDisconnectTimer(roomId, playerId);

                    socket.join(roomId);

                    socket.emit(
                        "chat_history",
                        roomManager.getChat(roomId)
                    );

                    const publicRoom =
                        gameManager.getPublicRoomState(
                            room
                        );

                    io.to(roomId).emit(
                        "room_updated",
                        publicRoom
                    );

                    const privateState =
                        gameManager.getPrivateGameState(
                            room,
                            playerId
                        );

                    socket.emit(
                        "game_state",
                        privateState
                    );

                    callback?.({
                        success: true,
                        room: publicRoom,
                        gameState: privateState
                    });

                } catch (error) {
                    callback?.({
                        success: false,
                        message: error.message
                    });
                }
            }
        );        


        // =============================================
        // GUESS POKEMON
        // =============================================
socket.on(
    "guess_pokemon",
    ({ roomId, pokemonId, targetPlayerId }, callback) => {
        try {
            if (!roomId) {
                throw new Error("Room ID is required");
            }

            if (
                pokemonId === undefined ||
                pokemonId === null
            ) {
                throw new Error("Pokemon ID is required");
            }

            const result =
                gameManager.guessPokemon(
                    roomId,
                    socket.playerId,
                    pokemonId,
                    targetPlayerId
                );

            // =========================================
            // CALLBACK FOR THE GUESSER
            // =========================================

            callback?.({
                success: true,
                result
            });

            // =========================================
            // BROADCAST THE RESULT TO THE WHOLE ROOM
            // =========================================
            io.to(roomId).emit(
                "player_guess_result",
                {
                    playerId: socket.playerId,
                    guesserName: result.guesserName,
                    guessedPokemon: result.guessedPokemon,
                    targetPlayerId:
                        result.targetPlayerId ||
                        targetPlayerId,

                    correct: result.correct,

                    autoRevealed: result.autoRevealed || false,

                    revealedPlayerId: result.autoRevealed ? result.revealedPlayerId : (result.correct ? result.targetPlayerId : null),
                    
                    revealedPokemon:
                        result.correct || result.autoRevealed
                            ? result.targetPokemon
                            : null,

                    score: result.score,

                    totalScore:
                        result.totalScore,

                    guesses:
                        result.guesses,

                    wrongGuesses:
                        result.wrongGuesses || []
                }
            );

            // =========================================
            // GAME FINISHED
            // =========================================

            if (result.gameFinished) {

                const room =
                    roomManager.getRoom(roomId);

                if (!room) {
                    throw new Error(
                        "Room not found"
                    );
                }

                const scoreboard =
                    gameManager.getFinalResults(
                        room
                    );

                io.to(roomId).emit(
                    "game_finished",
                    scoreboard
                );

                // Write the PVP leaderboard for pvp rooms.
                // Runs in the background; errors never affect the game response.
                if (room.mode === "pvp") {
                    recordPvpLeaderboard(room, scoreboard).catch(
                        (error) => {
                            console.error(
                                "[pvp] leaderboard write failed:",
                                error.message
                            );
                        }
                    );
                }
            }

        } catch (error) {

            console.error(
                "guess_pokemon error:",
                error
            );

            callback?.({
                success: false,
                message: error.message
            });
        }
    }
);

        // =============================================
        // USE CLUE
        // =============================================
        socket.on(
            "use_clue",
            ({ roomId, filterKey }, callback) => {
                try {
                    if (!roomId) {
                        throw new Error(
                            "Room ID is required"
                        );
                    }

                    if (!filterKey) {
                        throw new Error(
                            "Filter key is required"
                        );
                    }

                    const result =
                        gameManager.useClue(
                            roomId,
                            socket.playerId,
                            filterKey
                        );

                    callback?.({
                        success: true,
                        cluesUsed:
                            result.cluesUsed
                    });

                } catch (error) {
                    callback?.({
                        success: false,
                        message: error.message
                    });
                }
            }
        );

        // =============================================
        // REMATCH
        // =============================================
        socket.on(
            "rematch",
            ({ roomId }, callback) => {
                try {
                    const room = gameManager.rematch(roomId, socket.playerId);
                    const publicRoom = gameManager.getPublicRoomState(room);

                    io.to(roomId).emit("game_choosing", publicRoom); // still fine when called repeatedly

                    callback?.({ success: true });
                filters.name} catch (error) {
                    callback?.({ success: false, message: error.message });
                }
            }
        );
        // =============================================
        // UPDATE FILTERS
        // =============================================

        socket.on(
            "update_filters",
            async ({ roomId, filters }, callback) => {
                try {
                    const result =
                        await gameManager.updateFilters(
                            roomId,
                            socket.playerId,
                            filters
                        );

                    callback?.({
                        success: true,
                        filters: result.filters,
                        candidates: result.candidates
                    });

                } catch (error) {
                    callback?.({
                        success: false,
                        message: error.message
                    });
                }
            }
        );
    });
}


// =============================================
// SEND PRIVATE GAME STATE
// =============================================

function sendPrivateGameStates(io, room) {
    for (const player of room.players) {

        if (!player.socketId) {
            continue;
        }

        const privateState =
            gameManager.getPrivateGameState(
                room,
                player.id
            );

        io.to(player.socketId).emit(
            "game_started",
            privateState
        );
    }
}

// =============================================
// LEAVE ROOM
// =============================================

function leaveRoom(
    io,
    socket,
    roomId
) {

    const room =
        roomManager.leaveRoom(
            roomId,
            socket.id
        );

    socket.leave(roomId);

    if (!room) {

        io.to(roomId).emit(
            "room_closed"
        );

        return;
    }

    const publicRoom =
        gameManager.getPublicRoomState(room);

    io.to(roomId).emit(
        "player_pokemon_selected",
        {
            playerId: socket.id
        }
    );

    io.to(roomId).emit(
        "room_updated",
        publicRoom
    );

    if (
        gameManager.allPlayersSelected(room)
    ) {
        gameManager.initializeGame(room);

        sendPrivateGameStates(
            io,
            room
        );
    }
}


module.exports = setupGameSocket;