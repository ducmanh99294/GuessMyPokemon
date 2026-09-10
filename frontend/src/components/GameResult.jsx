import socket from "../socket/socket";

function GameResult({
    result,
    roomId,
    onRematch,
    onLeave
}) {
    function handleRematch() {
        socket.emit(
            "rematch",
            { roomId },
            (response) => {
                if (!response?.success) {
                    alert(
                        response?.message ||
                        "Failed to rematch"
                    );
                    return;
                }

                onRematch?.();
            }
        );
    }

    return (
        <main className="game-result">
            <header>
                <h1>Game Finished!</h1>
                <p>
                    Everyone has finished the game.
                </p>
            </header>

            <section className="scoreboard">
                <h2>Scoreboard</h2>

                {result.players.map(
                    (player, index) => (
                        <div
                            key={player.id}
                            className="score-row"
                        >
                            <span className="rank">
                                #{index + 1}
                            </span>

                            <div className="player-info">
                                <strong>
                                    {player.name}
                                </strong>

                                <small>
                                    {player.cluesUsed} clues
                                    {" • "}
                                    {player.guesses} guesses
                                </small>
                            </div>

                            <strong className="score">
                                {player.score}
                            </strong>
                        </div>
                    )
                )}
            </section>

            <section className="revealed-pokemon">
                <h2>Pokémon Revealed</h2>

                {result.players.map(
                    (player) => (
                        <div
                            key={player.id}
                            className="revealed-player"
                        >
                            <h3>
                                {player.name}
                            </h3>

                            {player.targetPokemon
                                ?.sprite && (
                                <img
                                    src={
                                        player
                                            .targetPokemon
                                            .sprite
                                    }
                                    alt={
                                        player
                                            .targetPokemon
                                            .name
                                    }
                                />
                            )}

                            <strong>
                                {
                                    player
                                        .targetPokemon
                                        ?.name
                                }
                            </strong>
                        </div>
                    )
                )}
            </section>

            <div className="result-actions">
                <button
                    onClick={handleRematch}
                >
                    Rematch
                </button>

                <button onClick={onLeave}>
                    Leave Room
                </button>
            </div>
        </main>
    );
}

export default GameResult;