const roomManager = require("../managers/roomManager");
const gameManager = require("../managers/gameManager");

function setupGameSocket(io) {

    io.on("connection", (socket) => {

        console.log("Player connected:", socket.id);

        // =========================================
        // CREATE ROOM
        // =========================================

        socket.on(
            "create_room",
            ({ playerId, name, mode = "private" }, callback) => {

                try {
                    if (!playerId) {
                        throw new Error("Player ID is required");
                    }

                    socket.playerId = playerId; // ⭐ THÊM

                    const room =
                        roomManager.createRoom(
                            {
                                id: playerId,
                                socketId: socket.id,
                                name: name || "Player"
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
            ({ roomId, playerId, name }, callback) => {

                try {
                    if (!playerId) {
                        throw new Error("Player ID is required");
                    }

                    socket.playerId = playerId;

                    const normalizedRoomId =
                        roomId.trim().toUpperCase();

                    const room =
                        roomManager.joinRoom(
                            normalizedRoomId,
                            {
                                id: playerId,
                                socketId: socket.id,
                                name: name || "Player"
                            }
                        );

                    socket.join(normalizedRoomId);

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

                    console.log(
                        `${name} joined room ${normalizedRoomId}`
                    );

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
                            socket.playerId, // ⭐ FIX
                            pokemonId
                        );

                    const room = result.room;

                    io.to(roomId).emit(
                        "player_pokemon_selected",
                        {
                            playerId: socket.playerId // ⭐ FIX
                        }
                    );

                    io.to(roomId).emit(
                        "room_updated",
                        gameManager.getPublicRoomState(room)
                    );

                    if (
                        gameManager.allPlayersSelected(room)
                    ) {

                        gameManager.initializeGame(room);

                        sendPrivateGameStates(
                            io,
                            room
                        );

                        console.log(
                            `Game started in room ${roomId}`
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
                const room = roomManager.getRoom(roomId);

                if (!room) {
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

                const updatedRoom = roomManager.leaveRoom(
                    roomId,
                    playerId
                );

                socket.leave(roomId);

                if (updatedRoom) {
                    io.to(roomId).emit(
                        "room_updated",
                        gameManager.getPublicRoomState(updatedRoom)
                    );
                }

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

                console.log(
                    "Player disconnected:",
                    socket.id
                );

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
                }
            }
        );

        // =============================================
        // reconnect_room
        // =============================================

        socket.on(
            "reconnect_room",
            ({ roomId, playerId }, callback) => {
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

                    socket.playerId = playerId;
                    player.socketId = socket.id;
                    player.connected = true;
                    player.disconnectAt = null;

                    socket.join(roomId);

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
                        throw new Error(
                            "Room ID is required"
                        );
                    }

                    if (
                        pokemonId === undefined ||
                        pokemonId === null
                    ) {
                        throw new Error(
                            "Pokemon ID is required"
                        );
                    }

                    const result =
                        gameManager.guessPokemon(
                            roomId,
                            socket.playerId,
                            pokemonId,
                            targetPlayerId
                        );

                    callback?.({
                        success: true,
                        result
                    });

                    if (result.gameFinished !== undefined) {
                        const room = roomManager.getRoom(roomId);

                        // ⭐ Broadcast cho CẢ PHÒNG, bao gồm cả target pokemon đã bị lộ
                        io.to(roomId).emit(
                            "player_guess_result",
                            {
                                playerId: socket.playerId,
                                targetPlayerId: result.targetPlayerId || targetPlayerId, // ai bị đoán trúng
                                correct: result.correct,
                                revealedPokemon: result.correct ? result.targetPokemon : null, // ⭐ tên pokemon lộ ra nếu đúng
                                score: result.score,
                                totalScore: result.totalScore,
                                guesses: result.guesses,
                                solvedCount: result.solvedCount,
                                totalTargets: result.totalTargets,
                                playerFullyFinished: result.playerFullyFinished
                            }
                        );

                        // Callback riêng cho người đoán vẫn giữ (để họ biết chi tiết ngay, không cần chờ broadcast)
                        callback?.({
                            success: true,
                            result
                        });

                        if (result.gameFinished) {
                            const scoreboard = gameManager.getFinalResults(room);
                            io.to(roomId).emit("game_finished", scoreboard);
                        }
                    }

                    if (result.gameFinished) {
                        const scoreboard =
                            gameManager.getFinalResults(room);

                        io.to(roomId).emit(
                            "game_finished",
                            scoreboard
                        );
                    }

                    console.log(
                        `[GUESS] ${socket.id} guessed ${pokemonId} → ${
                            result.correct
                                ? "CORRECT"
                                : "WRONG"
                        }`
                    );
                } catch (error) {
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

                    io.to(roomId).emit("game_choosing", publicRoom); // vẫn OK khi gọi lặp lại

                    callback?.({ success: true });
                } catch (error) {
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
            console.log(
                `⚠️ Player ${player.id} has no socketId`
            );
            continue;
        }

        const privateState =
            gameManager.getPrivateGameState(
                room,
                player.id
            );

        console.log(
            `📤 Sending game_started to ${player.id} via ${player.socketId}`
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

        console.log(
            `Game started in room ${roomId}`
        );
    }
}


module.exports = setupGameSocket;