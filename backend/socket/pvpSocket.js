// =====================================================
// PVP Quick Match - random pairing
//
// Events (client -> server):
// - "pvp_find_match"   ({ playerId, playerName }) -> join the queue.
//   When 2 are ready: create a "pvp" room, put both sockets in,
//   auto-start it (status "choosing"), then emit "pvp_matched"
//   { roomId, opponent } to each player.
// - "pvp_cancel_match" ({ playerId })             -> leave the queue.
//
// After "pvp_matched", the client navigates to /lobby/:roomId.
// Because the room is already "choosing", the lobby renders
// PokemonSelector immediately — no extra Start click needed.
// When both picked, "game_started" fires -> /game/:roomId.
// =====================================================

const roomManager = require("../managers/roomManager");
const gameManager = require("../managers/gameManager");
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

// Matchmaking queue: Map<playerId, { playerId, name, socket, joinedAt }>
const queue = new Map();

function setupPvpSocket(io) {
    io.on("connection", (socket) => {
        // =========================================
        // FIND MATCH
        // =========================================

        socket.on(
            "pvp_find_match",
            async ({ playerId, playerName, authToken }, callback) => {
                try {
                    if (!playerId) {
                        throw new Error("Player ID is required");
                    }

                    socket.playerId = playerId;

                    // Keep it raw (may be "") — tryMatch assigns
                    // "Player 1" / "Player 2" in match order
                    const name =
                        String(playerName || "")
                            .trim()
                            .slice(0, 20);

                    const auth = await resolveAuth(authToken);

                    // Already in queue -> update to the new socket
                    // (avoid duplicates when the user re-searches / reconnects)
                    if (queue.has(playerId)) {
                        queue.get(playerId).socket = socket;
                        queue.get(playerId).name = name;
                        queue.get(playerId).isGuest = auth.isGuest;

                        callback?.({
                            success: true,
                            status: "searching",
                            position: positionOf(playerId),
                        });

                        tryMatch(io);
                        return;
                    }

                    queue.set(playerId, {
                        playerId,
                        name,
                        isGuest: auth.isGuest,
                        socket,
                        joinedAt: Date.now(),
                    });

                    callback?.({
                        success: true,
                        status: "searching",
                        position: queue.size,
                    });

                    tryMatch(io);
                } catch (error) {
                    callback?.({
                        success: false,
                        message: error.message,
                    });
                }
            }
        );

        // =========================================
        // CANCEL MATCH
        // =========================================

        socket.on(
            "pvp_cancel_match",
            ({ playerId } = {}, callback) => {
                queue.delete(playerId || socket.playerId);

                callback?.({ success: true });
            }
        );

        // =========================================
        // DISCONNECT -> leave the queue
        // =========================================

        socket.on("disconnect", () => {
            for (const [pid, entry] of queue) {
                if (entry.socket.id === socket.id) {
                    queue.delete(pid);
                }
            }
        });
    });
}

// Position in queue (1-based)
function positionOf(playerId) {
    let i = 1;

    for (const pid of queue.keys()) {
        if (pid === playerId) return i;
        i++;
    }

    return i;
}

// Pair up FIFO when 2 are ready
function tryMatch(io) {
    if (queue.size < 2) {
        return;
    }

    const [p1, p2] = [...queue.values()].slice(0, 2);

    // Drop disconnected sockets from the queue, then retry
    if (!p1.socket.connected || !p2.socket.connected) {
        if (!p1.socket.connected) queue.delete(p1.playerId);
        if (!p2.socket.connected) queue.delete(p2.playerId);

        tryMatch(io);
        return;
    }

    queue.delete(p1.playerId);
    queue.delete(p2.playerId);

    // Default names in match order when a player didn't enter one
    // (avoid colliding with the other player's custom name)
    let p1Name = p1.name;
    let p2Name = p2.name;

    if (!p1Name && !p2Name) {
        p1Name = "Player 1";
        p2Name = "Player 2";
    } else if (!p1Name) {
        p1Name = p2Name === "Player 1" ? "Player 2" : "Player 1";
    } else if (!p2Name) {
        p2Name = p1Name === "Player 2" ? "Player 1" : "Player 2";
    }

    // Reuse roomManager: 2-player pvp room
    const room = roomManager.createRoom(
        {
            id: p1.playerId,
            socketId: p1.socket.id,
            name: p1Name,
            isGuest: p1.isGuest === true,
        },
        "pvp"
    );

    roomManager.joinRoom(room.roomId, {
        id: p2.playerId,
        socketId: p2.socket.id,
        name: p2Name,
        isGuest: p2.isGuest === true,
    });

    // Jump straight to Pokemon selection — no extra "Start" click.
    // The lobby will render PokemonSelector because status === "choosing".
    gameManager.startGame(room.roomId);

    p1.socket.join(room.roomId);
    p2.socket.join(room.roomId);

    p1.socket.emit("pvp_matched", {
        roomId: room.roomId,
        opponent: { name: p2Name },
    });

    p2.socket.emit("pvp_matched", {
        roomId: room.roomId,
        opponent: { name: p1Name },
    });

    console.log(
        `[pvp] Matched ${p1Name} vs ${p2Name} -> room ${room.roomId}`
    );
}

module.exports = setupPvpSocket;