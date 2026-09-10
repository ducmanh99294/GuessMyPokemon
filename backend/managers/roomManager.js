class RoomManager {
    constructor() {
        this.rooms = new Map();
    }

    getChat(roomId) {
        const room = this.getRoom(roomId);

        if (!room) {
            return [];
        }

        return room.chat || [];
    }

    addChatMessage(roomId, message) {
        const room = this.getRoom(roomId);

        if (!room) {
            throw new Error("Room not found");
        }

        if (!room.chat) {
            room.chat = [];
        }

        room.chat.push(message);

        // Giới hạn chat để RAM không tăng vô hạn
        if (room.chat.length > 200) {
            room.chat.shift();
        }

        return message;
    }

    generateRoomId() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let roomId;

        do {
            roomId = "";

            for (let i = 0; i < 6; i++) {
                roomId += chars[
                    Math.floor(Math.random() * chars.length)
                ];
            }
        } while (this.rooms.has(roomId));

        return roomId;
    }

    createRoom(host, mode = "private") {
        if (!["private", "pvp"].includes(mode)) {
            throw new Error("Invalid room mode");
        }

        const roomId = this.generateRoomId();

        const room = {
            roomId,
            mode,

            hostId: host.id,

            status: "waiting",

            players: [
                this.createPlayer(host)
            ],
            chat: [],

            createdAt: Date.now()
        };

        this.rooms.set(roomId, room);

        return room;
    }

    createPlayer(player) {
        return {
            id: player.id,
            socketId: player.socketId || null,
            name: player.name,

            connected: true,
            disconnectAt: null,

            score: 0,

            game: {
                targetPokemon: null,
                targetPlayerId: null,
                candidates: [],

                filters: {
                    type: [],
                    generation: null,
                    legendary: null,
                    mythical: null,
                    mega: null,
                    hasEvolution: null,
                    evolutionForms: null,
                    effective: [],
                    noEffect: [],
                    notEffect: [],
                    superEffect: []
                },
                wrongGuesses: [],      
                lastGuessAt: null,
                cluesUsed: 0,
                guesses: 0,
                startTime: null,
                finished: false
            }
        };
    }

    joinRoom(roomId, player) {
        const room = this.rooms.get(roomId);

        if (!room) {
            throw new Error("Room not found");
        }

        const existingPlayer = room.players.find(
            existing =>
                existing.id === player.id
        );

        // Reconnect
        if (existingPlayer) {
            existingPlayer.socketId =
                player.socketId;

            existingPlayer.connected = true;
            existingPlayer.disconnectAt = null;

            if (player.name) {
                existingPlayer.name = player.name;
            }

            return room;
        }

        // Player mới
        if (room.status !== "waiting") {
            throw new Error("Game already started");
        }

        if (room.players.length >= 4) {
            throw new Error("Room is full");
        }

        room.players.push(
            this.createPlayer(player)
        );

        return room;
    }

    leaveRoom(roomId, playerId) {
        const room = this.rooms.get(roomId);

        if (!room) {
            return null;
        }

        room.players = room.players.filter(
            player => player.id !== playerId
        );

        if (room.players.length === 0) {
            this.rooms.delete(roomId);
            return null;
        }

        // Nếu host rời phòng,
        // player đầu tiên còn lại trở thành host
        if (room.hostId === playerId) {
            room.hostId = room.players[0].id;
        }

        return room;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId) || null;
    }

    getPlayers(roomId) {
        const room = this.getRoom(roomId);

        if (!room) {
            return [];
        }

        return room.players;
    }

    getPlayer(roomId, playerId) {
        const room = this.getRoom(roomId);

        if (!room) {
            return null;
        }

        return room.players.find(
            player => player.id === playerId
        ) || null;
    }

    startGame(roomId) {
        const room = this.getRoom(roomId);

        if (!room) {
            throw new Error("Room not found");
        }

        if (room.players.length < 1) {
            throw new Error("Not enough players");
        }

        if (room.status !== "waiting") {
            throw new Error("Game already started");
        }

        room.status = "choosing";

        return room;
    }

    deleteRoom(roomId) {
        return this.rooms.delete(roomId);
    }

    getAllRooms() {
        return Array.from(
            this.rooms.values()
        );
    }
}

module.exports = new RoomManager();