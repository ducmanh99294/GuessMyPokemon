const roomManager = require("../managers/roomManager");

function setupChatSocket(io) {
    io.on("connection", (socket) => {

        socket.on(
            "send_chat_message",
            ({ roomId, message }, callback) => {
                try {
                    if (!roomId) {
                        throw new Error(
                            "Room ID is required"
                        );
                    }

                    if (
                        !message ||
                        !message.trim()
                    ) {
                        throw new Error(
                            "Message cannot be empty"
                        );
                    }

                    const room =
                        roomManager.getRoom(roomId);

                    if (!room) {
                        throw new Error(
                            "Room not found"
                        );
                    }

                    const player =
                        room.players.find(
                            player =>
                                player.socketId ===
                                socket.id
                        );

                    if (!player) {
                        throw new Error(
                            "You are not in this room"
                        );
                    }

                    const chatMessage = {
                        id:
                            `${Date.now()}-${player.id}`,

                        playerId:
                            player.id,

                        playerName:
                            player.name,

                        message:
                            message.trim(),

                        timestamp:
                            Date.now()
                    };

                    roomManager.addChatMessage(
                        roomId,
                        chatMessage
                    );

                    io.to(roomId).emit(
                        "receive_chat_message",
                        chatMessage
                    );

                    callback?.({
                        success: true
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

module.exports = setupChatSocket;