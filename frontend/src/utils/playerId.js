// src/utils/playerId.js

const PLAYER_ID_KEY = import.meta.env.PLAYER_KEY;

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