// =====================================================
// PVP Quick Match - random pairing
//
// Events (client -> server):
// - "pvp_find_match"   ({ playerId, playerName }) -> join the queue.
//   When 2 are ready: create a "pvp" room, put both sockets in,
//   emit "pvp_matched" { roomId, opponent } to each player.
// - "pvp_cancel_match" ({ playerId })             -> leave the queue.
//
// After "pvp_matched", the client navigates to /game/:roomId.
// The pick/guess/scoring flow fully reuses
// gameManager + GameRoom like a normal room (reconnect_room
// reattaches the socket since the player is already in room.players).
// =====================================================

const roomManager = require("../managers/roomManager");

// Matchmaking queue: Map<playerId, { playerId, name, socket, joinedAt }>
const queue = new Map();

function setupPvpSocket(io) {
    io.on("connection", (socket) => {
        // =========================================
        // FIND MATCH
        // =========================================

        socket.on(
            "pvp_find_match",
            ({ playerId, playerName }, callback) => {
                try {
                    if (!playerId) {
                        throw new Error("Player ID is required");
                    }

                    socket.playerId = playerId;

                    const name =
                        String(playerName || "Player")
                            .trim()
                            .slice(0, 20) || "Player";

                    // Already in queue -> update to the new socket
                    // (avoid duplicates when the user re-searches / reconnects)
                    if (queue.has(playerId)) {
                        queue.get(playerId).socket = socket;
                        queue.get(playerId).name = name;

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

    // Reuse roomManager: 2-player pvp room
    const room = roomManager.createRoom(
        {
            id: p1.playerId,
            socketId: p1.socket.id,
            name: p1.name,
        },
        "pvp"
    );

    roomManager.joinRoom(room.roomId, {
        id: p2.playerId,
        socketId: p2.socket.id,
        name: p2.name,
    });

    p1.socket.join(room.roomId);
    p2.socket.join(room.roomId);

    p1.socket.emit("pvp_matched", {
        roomId: room.roomId,
        opponent: { name: p2.name },
    });

    p2.socket.emit("pvp_matched", {
        roomId: room.roomId,
        opponent: { name: p1.name },
    });

    console.log(
        `[pvp] Matched ${p1.name} vs ${p2.name} -> room ${room.roomId}`
    );
}

module.exports = setupPvpSocket;
