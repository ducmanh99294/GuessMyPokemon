// =====================================================
// PVP Quick Match - bắt cặp ngẫu nhiên
//
// Events (client -> server):
// - "pvp_find_match"   ({ playerId, playerName }) -> vào hàng chờ.
//   Đủ 2 người: tạo phòng mode "pvp", cho cả 2 socket vào phòng,
//   emit "pvp_matched" { roomId, opponent } cho từng người.
// - "pvp_cancel_match" ({ playerId })             -> rời hàng chờ.
//
// Sau "pvp_matched", client điều hướng tới /game/:roomId.
// Luồng chọn Pokémon / đoán / tính điểm dùng lại nguyên
// gameManager + GameRoom như phòng thường (reconnect_room
// tự gắn lại socket vì player đã có trong room.players).
// =====================================================

const roomManager = require("../managers/roomManager");

// Hàng chờ matchmaking: Map<playerId, { playerId, name, socket, joinedAt }>
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

                    // Đã trong hàng chờ -> cập nhật socket mới
                    // (tránh trùng khi user bấm tìm lại / reconnect)
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
        // DISCONNECT -> rời hàng chờ
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

// Vị trí trong hàng chờ (1-based)
function positionOf(playerId) {
    let i = 1;

    for (const pid of queue.keys()) {
        if (pid === playerId) return i;
        i++;
    }

    return i;
}

// Ghép cặp FIFO khi đủ 2 người
function tryMatch(io) {
    if (queue.size < 2) {
        return;
    }

    const [p1, p2] = [...queue.values()].slice(0, 2);

    // Bỏ socket đã rớt mạng khỏi hàng chờ rồi thử lại
    if (!p1.socket.connected || !p2.socket.connected) {
        if (!p1.socket.connected) queue.delete(p1.playerId);
        if (!p2.socket.connected) queue.delete(p2.playerId);

        tryMatch(io);
        return;
    }

    queue.delete(p1.playerId);
    queue.delete(p2.playerId);

    // Dùng lại roomManager: phòng pvp 2 người
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
