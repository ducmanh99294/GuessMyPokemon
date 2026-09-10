import { useEffect, useState } from "react";
import socket from "../socket/socket";
import { filterPokemon } from "../services/pokemonApi";
import '../css/PokemonSelector.css'
function PokemonSelector({ room, onGameStarted }) {
    const [pokemon, setPokemon] = useState([]);
    const [selectedPokemon, setSelectedPokemon] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function loadPokemon() {
            try {
                setLoading(true);

                const result = await filterPokemon();

                setPokemon(result.data || []);
            } catch (error) {
                setError(error.message);
            } finally {
                setLoading(false);
            }
        }

        loadPokemon();
    }, []);

    useEffect(() => {
        const handlePlayerSelected = ({ playerId }) => {
            console.log(
                "Player selected Pokemon:",
                playerId
            );
        };

        const handleGameStarted = (gameState) => {
            onGameStarted(gameState);
        };

        socket.on(
            "player_pokemon_selected",
            handlePlayerSelected
        );

        socket.on(
            "game_started",
            handleGameStarted
        );

        return () => {
            socket.off(
                "player_pokemon_selected",
                handlePlayerSelected
            );

            socket.off(
                "game_started",
                handleGameStarted
            );
        };
    }, [onGameStarted]);

    function selectPokemon(pokemon) {
        if (selecting) {
            return;
        }

        setSelectedPokemon(pokemon);
    }

    function confirmSelection() {
        if (!selectedPokemon) {
            setError("Please select a Pokémon");
            return;
        }

        setSelecting(true);
        setError("");

        socket.emit(
            "select_pokemon",
            {
                roomId: room.roomId,
                pokemonId: selectedPokemon.id
            },
            (response) => {
                if (!response.success) {
                    setError(response.message);
                    setSelecting(false);
                    return;
                }

                console.log(
                    "Pokemon selection confirmed"
                );
            }
        );
    }

    if (loading) {
        return (
        <div className="selector-page">
            <p className="selector-loading">Đang tải danh sách Pokémon...</p>
        </div>
        );
    }

    return (
    <div className="selector-page">
        <div className="selector-container">
            <header className="selector-header">
                <h1>Chọn Pokémon của bạn</h1>
                <p>
                    Chọn một Pokémon bí mật. Những người chơi khác
                    sẽ không thấy lựa chọn của bạn.
                </p>
            </header>

            <section className="selector-players">
                {room.players.map((player) => (
                    <div
                        key={player.id}
                        className={`selector-player-chip ${
                            player.hasSelectedPokemon ? "ready" : "waiting"
                        }`}
                    >
                        <span className="avatar">
                            {player.name?.charAt(0).toUpperCase()}
                        </span>
                        <span className="name">{player.name}</span>
                        <span className="state">
                            {player.hasSelectedPokemon ? "✓ Sẵn sàng" : "Đang chọn..."}
                        </span>
                    </div>
                ))}
            </section>

            {selectedPokemon && (
                <section className="selected-bar">
                    {selectedPokemon.sprite && (
                        <img
                            src={selectedPokemon.sprite}
                            alt={selectedPokemon.name}
                        />
                    )}

                    <div className="info">
                        <div className="label">Pokémon của bạn</div>
                        <div className="name">{selectedPokemon.name}</div>
                    </div>

                    <button
                        className="confirm-btn"
                        onClick={confirmSelection}
                        disabled={selecting}
                    >
                        {selecting ? "Đang chờ..." : "Xác nhận"}
                    </button>
                </section>
            )}

            <section>
                <h2>Pokémon</h2>

                <div className="pokemon-selector-grid">
                    {pokemon.map((item) => (
                        <button
                            key={item.id}
                            onClick={() =>
                                selectPokemon(item)
                            }
                            disabled={selecting}
                            className={
                                selectedPokemon?.id === item.id
                                    ? "selected"
                                    : ""
                            }
                        >
                            {item.sprite && (
                                <img
                                    src={item.sprite}
                                    alt={item.name}
                                    width="80"
                                />
                            )}

                            <span>{item.name}</span>
                        </button>
                    ))}
                </div>
            </section>

            {error && (
                <p>
                    Error: {error}
                </p>
            )}
            </div>
        </div>
    );
}

export default PokemonSelector;