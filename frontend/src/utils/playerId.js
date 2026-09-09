// src/utils/playerId.js

const PLAYER_ID_KEY = "pokemon_guess_player_id";

export function getPlayerId() {
    let playerId = localStorage.getItem(PLAYER_ID_KEY);

    if (!playerId) {
        playerId =
            "player_" +
            crypto.randomUUID();

        localStorage.setItem(
            PLAYER_ID_KEY,
            playerId
        );
    }

    return playerId;
}