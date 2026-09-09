const roomManager = require("./roomManager");
const pokemonMetadataCache = require("../cache/pokemonMetadataCache");
const pokemonFilterService =
    require("../services/pokemonFilterService");
    
const DEFAULT_FILTERS = {
    type: [],
    generation: null,
    legendary: null,
    mythical: null,
    hasEvolution: null,
    evolutionForms: null,
    effective: [],
    noEffect: [],
    notEffect: [],
    superEffect: []
};

const VALID_FILTER_KEYS = Object.keys(DEFAULT_FILTERS);

class GameManager {

    calculateScore(cluesUsed, elapsedSeconds) {
        const baseScore = 100;

        const cluePenalty =
            Math.min(cluesUsed * 5, 50);

        const timeBonus =
            Math.max(
                0,
                50 - Math.floor(elapsedSeconds / 10)
            );

        return Math.max(
            10,
            baseScore - cluePenalty + timeBonus
        );
    }

    startGame(roomId) {
        const room =
            roomManager.getRoom(roomId);

        if (!room) {
            throw new Error("Room not found");
        }

        if (room.status !== "waiting") {
            throw new Error(
                "Game has already started"
            );
        }

        if (room.players.length < 1) {
            throw new Error(
                "Not enough players"
            );
        }

        room.status = "choosing";

        return room;
    }

    selectPokemon(
        roomId,
        playerId,
        pokemonId
    ) {

        const room =
            roomManager.getRoom(roomId);

        if (!room) {
            throw new Error(
                "Room not found"
            );
        }

        if (room.status !== "choosing") {
            throw new Error(
                "Pokemon selection is not available"
            );
        }

        const player =
            roomManager.getPlayer(
                roomId,
                playerId
            );

        if (!player) {
            throw new Error(
                "Player not found"
            );
        }

        if (player.game.targetPokemon) {
            throw new Error(
                "Pokemon already selected"
            );
        }

        const pokemon =
            this.findPokemon(pokemonId);

        if (!pokemon) {
            throw new Error(
                "Pokemon not found"
            );
        }

        player.game.targetPokemon =
            pokemon;

        return {
            room,
            player
        };
    }

    findPokemon(pokemonId) {

        const pokemonList =
            pokemonMetadataCache.getAll();

        if (
            !pokemonList ||
            pokemonList.length === 0
        ) {
            return null;
        }

        const normalizedId =
            String(pokemonId)
                .trim()
                .toLowerCase();

        return pokemonList.find(
            pokemon =>
                String(pokemon.id)
                    .toLowerCase() === normalizedId ||

                String(pokemon.name)
                    .toLowerCase() === normalizedId
        ) || null;
    }

    allPlayersSelected(room) {

        return room.players.every(
            player =>
                player.game.targetPokemon !== null
        );
    }

    initializeGame(room) {

        const pokemonList =
            pokemonMetadataCache.getAll();

        for (const player of room.players) {

            player.game.candidates = [
                ...pokemonList
            ];

            player.game.filters = {
                type: [],
                generation: null,
                legendary: null,
                mythical: null,
                hasEvolution: null,
                evolutionForms: null,
                effective: [],
                noEffect: [],
                notEffect: [],
                superEffect: []
            };

            player.game.cluesUsed = 0;
            player.game.guesses = 0;
            player.game.startTime = Date.now();
            player.game.finished = false;

            // Hiện tại chọn player tiếp theo
            // để đoán sẽ xử lý ở bước sau.
            const players = room.players;

            for (let i = 0; i < players.length; i++) {
                const currentPlayer = players[i];

                const nextPlayer =
                    players[(i + 1) % players.length];

                currentPlayer.game.targetPlayerId =
                    nextPlayer.id;
            }

            room.status = "playing";

            return room;
        }

        room.status = "playing";

        return room;
    }

    getPublicRoomState(room) {

        return {
            roomId: room.roomId,
            mode: room.mode,
            status: room.status,
            hostId: room.hostId,

            players: room.players.map(
                player => ({
                    id: player.id,
                    name: player.name,
                    score: player.score,

                    connected:
                        player.connected,
                    // Chỉ cho biết đã chọn hay chưa
                    hasSelectedPokemon:
                        !!player.game.targetPokemon,

                    finished:
                        player.game.finished
                })
            ),

            createdAt: room.createdAt
        };
    }

    getPrivateGameState(
        room,
        playerId
    ) {

        const player =
            roomManager.getPlayer(
                room.roomId,
                playerId
            );

        if (!player) {
            return null;
        }

        return {
            roomId: room.roomId,
            mode: room.mode,
            status: room.status,

            players: room.players.map(
                otherPlayer => ({
                    id: otherPlayer.id,
                    name: otherPlayer.name,
                    score: otherPlayer.score,
                    finished:
                        otherPlayer.game.finished
                })
            ),

            // Pokémon của chính mình
            // KHÔNG được gửi Pokémon của người khác
            hasSelectedPokemon:
                !!player.game.targetPokemon,

            targetPlayerId:
                player.game.targetPlayerId,

            candidates:
                player.game.candidates,

            filters:
                player.game.filters,

            cluesUsed:
                player.game.cluesUsed,

            guesses:
                player.game.guesses,

            finished:
                player.game.finished
        };
    }

    guessPokemon(roomId, playerId, pokemonId) {
        const room = roomManager.getRoom(roomId);

        if (!room) {
            throw new Error("Room not found");
        }

        if (room.status !== "playing") {
            throw new Error("Game is not in progress");
        }

        const player = roomManager.getPlayer(
            roomId,
            playerId
        );

        if (!player) {
            throw new Error("Player not found");
        }

        if (player.game.finished) {
            throw new Error("You have already finished");
        }

        const targetPlayer = roomManager.getPlayer(
            roomId,
            player.game.targetPlayerId
        );

        if (!targetPlayer) {
            throw new Error("Target player not found");
        }

        const guessedPokemon = this.findPokemon(pokemonId);

        if (!guessedPokemon) {
            throw new Error("Pokemon not found");
        }

        const targetPokemon =
            targetPlayer.game.targetPokemon;

        if (!targetPokemon) {
            throw new Error(
                "Target Pokemon has not been selected"
            );
        }

        player.game.guesses += 1;

        const isCorrect =
            String(guessedPokemon.id).toLowerCase() ===
            String(targetPokemon.id).toLowerCase();

            if (isCorrect) {
            player.game.finished = true;

            const elapsedTime =
                Date.now() - player.game.startTime;

            const elapsedSeconds =
                Math.floor(elapsedTime / 1000);

            const score = this.calculateScore(
                player.game.cluesUsed,
                elapsedSeconds
            );

            player.score += score;

            const gameFinished =
                this.isGameFinished(room);

            if (gameFinished) {
                room.status = "finished";
            }

            return {
                correct: true,
                guessedPokemon,
                targetPokemon,
                score,
                totalScore: player.score,
                cluesUsed: player.game.cluesUsed,
                guesses: player.game.guesses,
                elapsedSeconds,
                gameFinished
            };
        }
        return {
            correct: false,
            guessedPokemon,
            score: 0,
            totalScore: player.score,
            cluesUsed: player.game.cluesUsed,
            guesses: player.game.guesses
        };
    }

    useClue(roomId, playerId, filterKey) {
        const room = roomManager.getRoom(roomId);

        if (!room) {
            throw new Error("Room not found");
        }

        if (room.status !== "playing") {
            throw new Error("Game is not in progress");
        }

        const player =
            roomManager.getPlayer(
                roomId,
                playerId
            );

        if (!player) {
            throw new Error("Player not found");
        }

        if (player.game.finished) {
            throw new Error(
                "You have already finished"
            );
        }

        if (!VALID_FILTER_KEYS.includes(filterKey)) {
            throw new Error(
                "Invalid filter key"
            );
        }

        player.game.cluesUsed += 1;

        return {
            filterKey,
            cluesUsed: player.game.cluesUsed
        };
    }

async updateFilters(
    roomId,
    playerId,
    filters
) {
    const room =
        roomManager.getRoom(roomId);

    if (!room) {
        throw new Error("Room not found");
    }

    if (room.status !== "playing") {
        throw new Error(
            "Game is not in progress"
        );
    }

    const player =
        roomManager.getPlayer(
            roomId,
            playerId
        );

    if (!player) {
        throw new Error(
            "Player not found"
        );
    }

    if (player.game.finished) {
        throw new Error(
            "You have already finished"
        );
    }

    if (
        !filters ||
        typeof filters !== "object"
    ) {
        throw new Error(
            "Invalid filters"
        );
    }

    const updatedFilters = {
        ...player.game.filters
    };

    for (const key of VALID_FILTER_KEYS) {
        if (!(key in filters)) {
            continue;
        }

        updatedFilters[key] =
            filters[key];
    }

    // Lưu filter
    player.game.filters =
        updatedFilters;

    // ⭐ Lọc Pokémon
    const candidates =
        await pokemonFilterService.filterPokemon(
            updatedFilters
        );

    // ⭐ Cập nhật candidates
    player.game.candidates =
        candidates;

    return {
        filters: player.game.filters,
        candidates: player.game.candidates
    };
}

    isGameFinished(room) {
        return room.players.every(
            player => player.game.finished
        );
    }

    getScoreboard(room) {
        return {
            roomId: room.roomId,
            players: room.players
                .map(player => ({
                    id: player.id,
                    name: player.name,
                    score: player.score,
                    finished: player.game.finished,
                    guesses: player.game.guesses,
                    cluesUsed: player.game.cluesUsed
                }))
                .sort(
                    (a, b) =>
                        b.score - a.score
                )
        };
    }

    getFinalResults(room) {
        return {
            roomId: room.roomId,

            players: room.players
                .map(player => ({
                    id: player.id,
                    name: player.name,
                    score: player.score,
                    guesses: player.game.guesses,
                    cluesUsed: player.game.cluesUsed,
                    targetPokemon:
                        player.game.targetPokemon
                }))
                .sort(
                    (a, b) =>
                        b.score - a.score
                )
        };
    }

    rematch(roomId, playerId) {
        const room =
            roomManager.getRoom(roomId);

        if (!room) {
            throw new Error(
                "Room not found"
            );
        }

        if (room.status !== "finished") {
            throw new Error(
                "Game has not finished"
            );
        }

        const player =
            roomManager.getPlayer(
                roomId,
                playerId
            );

        if (!player) {
            throw new Error(
                "Player not found"
            );
        }

        for (const currentPlayer of room.players) {
            currentPlayer.game.targetPokemon = null;
            currentPlayer.game.targetPlayerId = null;
            currentPlayer.game.candidates = [];

            currentPlayer.game.filters = {
                type: [],
                generation: null,
                legendary: null,
                mythical: null,
                hasEvolution: null,
                evolutionForms: null,
                effective: [],
                noEffect: [],
                notEffect: [],
                superEffect: []
            };

            currentPlayer.game.cluesUsed = 0;
            currentPlayer.game.guesses = 0;
            currentPlayer.game.startTime = null;
            currentPlayer.game.finished = false;
        }

        room.status = "choosing";

        return room;
    }
}

module.exports = new GameManager();