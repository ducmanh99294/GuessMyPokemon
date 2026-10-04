import socket from "../socket/socket";
import "../css/GameResult.css";

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
        <div className="result-page">
        <main className="game-result">

            <header className="result-header">
                <div className="trophy-icon">🏆</div>
                <h1>Game Finished!</h1>
                <p>All secret Pokémon have been revealed.</p>
            </header>

            <section className="scoreboard">
                <h2>Leaderboard</h2>

                <div className="score-list">
                    {result.players.map(
                        (player, index) => (
                            <div
                                key={player.id}
                                className={`score-row ${
                                    index === 0 ? "first" : ""
                                }`}
                            >
                                <span className="rank">
                                    {index === 0 && "🥇"}
                                    {index === 1 && "🥈"}
                                    {index === 2 && "🥉"}
                                    {index > 2 && `#${index + 1}`}
                                </span>

                                <div className="player-info">
                                    <strong>{player.name}</strong>

                                    <small>
                                        {player.cluesUsed} clues
                                        {" • "}
                                        {player.guesses} guesses
                                    </small>
                                </div>

                                <strong className="score">
                                    {player.score}
                                    <span className="score-unit">pts</span>
                                </strong>
                            </div>
                        )
                    )}
                </div>
            </section>

            <section className="revealed-pokemon">
                <h2>Revealed Pokémon</h2>

                <div className="revealed-grid">
                    {result.players.map(
                        (player) => (
                            <div
                                key={player.id}
                                className="revealed-card"
                            >
                                <div className="revealed-sprite">
                                    {player.targetPokemon?.sprite ? (
                                        <img
                                            src={player.targetPokemon.sprite}
                                            alt={player.targetPokemon.name}
                                        />
                                    ) : (
                                        <span className="no-sprite">?</span>
                                    )}
                                </div>

                                <div className="revealed-name">
                                    {player.targetPokemon?.name || "???"}
                                </div>

                                <div className="revealed-owner">
                                    of {player.name}
                                </div>
                            </div>
                        )
                    )}
                </div>
            </section>

            <div className="result-actions">
                <button
                    className="btn-rematch"
                    onClick={handleRematch}
                >
                    <i className="fas fa-redo"></i>
                    Play Again
                </button>

                <button
                    className="btn-leave"
                    onClick={onLeave}
                >
                    <i className="fas fa-sign-out-alt"></i>
                    Leave Room
                </button>
            </div>

        </main>
        </div>

    );
}

export default GameResult;