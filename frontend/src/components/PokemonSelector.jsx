import { useEffect, useState } from "react";
import socket from "../socket/socket";
import { filterPokemon } from "../services/pokemonApi";

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
        if (selecting || selectedPokemon) {
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
            <main>
                <h1>Choose your Pokémon</h1>
                <p>Loading Pokémon...</p>
            </main>
        );
    }

    return (
        <main>
            <header>
                <h1>Choose your Pokémon</h1>

                <p>
                    Choose one Pokémon secretly.
                    Other players will not see your choice.
                </p>
            </header>

            <section>
                <h2>Players</h2>

                {room.players.map((player) => (
                    <div key={player.id}>
                        <span>{player.name}</span>

                        {player.hasSelectedPokemon ? (
                            <strong> ✓ Ready</strong>
                        ) : (
                            <span> Choosing...</span>
                        )}
                    </div>
                ))}
            </section>

            {selectedPokemon && (
                <section>
                    <h2>Your Pokémon</h2>

                    <div>
                        {selectedPokemon.sprite && (
                            <img
                                src={selectedPokemon.sprite}
                                alt={selectedPokemon.name}
                                width="120"
                            />
                        )}

                        <h3>
                            {selectedPokemon.name}
                        </h3>

                        <button
                            onClick={confirmSelection}
                            disabled={selecting}
                        >
                            {selecting
                                ? "Waiting for players..."
                                : "Confirm"}
                        </button>
                    </div>
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
        </main>
    );
}

export default PokemonSelector;