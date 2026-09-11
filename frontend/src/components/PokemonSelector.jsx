import { useEffect, useMemo, useState } from "react";
import socket from "../socket/socket";
import { filterPokemon } from "../services/pokemonApi";
import FilterPanel from "./FilterPanel";
import "../css/PokemonSelector.css";

const DEFAULT_FILTERS = {
    name: "",
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
};

function PokemonSelector({ room, onGameStarted }) {
    const [pokemon, setPokemon] = useState([]);
    const [selectedPokemon, setSelectedPokemon] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState(false);
    const [error, setError] = useState("");

    // Filter chỉ dùng local trong màn hình chọn Pokémon
    const [filters, setFilters] = useState(DEFAULT_FILTERS);

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
            console.log("Player selected Pokemon:", playerId);
        };

        const handleGameStarted = (gameState) => {
            onGameStarted(gameState);
        };

        socket.on("player_pokemon_selected", handlePlayerSelected);
        socket.on("game_started", handleGameStarted);

        return () => {
            socket.off("player_pokemon_selected", handlePlayerSelected);
            socket.off("game_started", handleGameStarted);
        };
    }, [onGameStarted]);

    /*
     * ==========================================
     * FILTER
     * ==========================================
     */

    function updateFilter(key, value) {
        setFilters((prev) => ({
            ...prev,
            [key]: value
        }));
    }

    function removeFilter(key) {
        setFilters((prev) => {
            const currentValue = prev[key];

            return {
                ...prev,
                [key]: Array.isArray(currentValue) ? [] : null
            };
        });
    }

    /*
     * Lấy types của Pokémon
     * Hỗ trợ cả:
     * ["fire", "flying"]
     *
     * hoặc:
     * [{ name: "fire" }, { name: "flying" }]
     */
    function getPokemonTypes(item) {
        if (!Array.isArray(item.types)) {
            return [];
        }

        return item.types
            .map((type) => {
                if (typeof type === "string") {
                    return type.toLowerCase();
                }

                return type?.name?.toLowerCase();
            })
            .filter(Boolean);
    }

    function matchesBooleanFilter(value, filterValue) {
        if (filterValue === null || filterValue === undefined) {
            return true;
        }

        if (typeof value === "string") {
            return value.toLowerCase() === String(filterValue).toLowerCase();
        }

        return Boolean(value) === Boolean(filterValue);
    }

    const filteredPokemon = useMemo(() => {
        return pokemon.filter((item) => {
            /*
             * ============================
             * NAME
             * ============================
             */
            if (filters.name?.trim()) {
                const searchName = filters.name
                    .trim()
                    .toLowerCase();

                const pokemonName = String(item.name || "")
                    .toLowerCase();

                if (!pokemonName.includes(searchName)) {
                    return false;
                }
            }

            /*
             * ============================
             * TYPE
             * ============================
             */
            if (
                Array.isArray(filters.type) &&
                filters.type.length > 0
            ) {
                const pokemonTypes = getPokemonTypes(item);

                const selectedTypes = filters.type.map((type) =>
                    String(type).toLowerCase()
                );

                const hasMatchingType = selectedTypes.some((type) =>
                    pokemonTypes.includes(type)
                );

                if (!hasMatchingType) {
                    return false;
                }
            }

            /*
             * ============================
             * GENERATION
             * ============================
             */
            if (
                filters.generation !== null &&
                filters.generation !== undefined
            ) {
                if (
                    String(item.generation) !==
                    String(filters.generation)
                ) {
                    return false;
                }
            }

            /*
             * ============================
             * LEGENDARY
             * ============================
             */
            if (
                filters.legendary !== null &&
                filters.legendary !== undefined
            ) {
                if (
                    !matchesBooleanFilter(
                        item.legendary,
                        filters.legendary
                    )
                ) {
                    return false;
                }
            }

            /*
             * ============================
             * MYTHICAL
             * ============================
             */
            if (
                filters.mythical !== null &&
                filters.mythical !== undefined
            ) {
                if (
                    !matchesBooleanFilter(
                        item.mythical,
                        filters.mythical
                    )
                ) {
                    return false;
                }
            }

            /*
             * ============================
             * MEGA
             * ============================
             */
            if (
                filters.mega !== null &&
                filters.mega !== undefined
            ) {
                if (
                    !matchesBooleanFilter(
                        item.mega,
                        filters.mega
                    )
                ) {
                    return false;
                }
            }

            /*
             * ============================
             * HAS EVOLUTION
             * ============================
             */
            if (
                filters.hasEvolution !== null &&
                filters.hasEvolution !== undefined
            ) {
                if (
                    !matchesBooleanFilter(
                        item.hasEvolution,
                        filters.hasEvolution
                    )
                ) {
                    return false;
                }
            }

            /*
             * ============================
             * EVOLUTION FORMS
             * ============================
             */
            if (
                filters.evolutionForms !== null &&
                filters.evolutionForms !== undefined
            ) {
                if (
                    String(item.evolutionForms) !==
                    String(filters.evolutionForms)
                ) {
                    return false;
                }
            }

            return true;
        });
    }, [pokemon, filters]);

    /*
     * ==========================================
     * SELECT POKEMON
     * ==========================================
     */

    function selectPokemon(pokemon) {
        if (selecting) {
            return;
        }

        setSelectedPokemon(pokemon);
    }

    /*
     * ==========================================
     * CONFIRM
     * ==========================================
     */

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
                if (!response?.success) {
                    setError(
                        response?.message ||
                        "Không thể chọn Pokémon"
                    );

                    setSelecting(false);
                    return;
                }

                console.log("Pokemon selection confirmed");
            }
        );
    }

    /*
     * ==========================================
     * LOADING
     * ==========================================
     */

    if (loading) {
        return (
            <div className="selector-page">
                <p className="selector-loading">
                    Đang tải danh sách Pokémon...
                </p>
            </div>
        );
    }

    /*
     * ==========================================
     * RENDER
     * ==========================================
     */

    return (
        <div className="selector-page">
            <div className="selector-container">

                {/* HEADER */}
                <header className="selector-header">
                    <h1>Chọn Pokémon của bạn</h1>

                    <p>
                        Chọn một Pokémon bí mật. Những người chơi khác
                        sẽ không thấy lựa chọn của bạn.
                    </p>
                </header>

                {/* PLAYERS */}
                <section className="selector-players">
                    {room.players.map((player) => (
                        <div
                            key={player.id}
                            className={`selector-player-chip ${
                                player.hasSelectedPokemon
                                    ? "ready"
                                    : "waiting"
                            }`}
                        >
                            <span className="avatar">
                                {player.name
                                    ?.charAt(0)
                                    .toUpperCase()}
                            </span>

                            <span className="name">
                                {player.name}
                            </span>

                            <span className="state">
                                {player.hasSelectedPokemon
                                    ? "✓ Sẵn sàng"
                                    : "Đang chọn..."}
                            </span>
                        </div>
                    ))}
                </section>

                {/* SELECTED POKEMON */}
                {selectedPokemon && (
                    <section className="selected-bar">
                        {selectedPokemon.sprite && (
                            <img
                                src={selectedPokemon.sprite}
                                alt={selectedPokemon.name}
                            />
                        )}

                        <div className="info">
                            <div className="label">
                                Pokémon của bạn
                            </div>

                            <div className="name">
                                {selectedPokemon.name}
                            </div>
                        </div>

                        <button
                            className="confirm-btn"
                            onClick={confirmSelection}
                            disabled={selecting}
                        >
                            {selecting
                                ? "Đang chờ..."
                                : "Xác nhận"}
                        </button>
                    </section>
                )}

                {/* MAIN CONTENT */}
                <div className="selector-content">

                    {/* FILTER */}
                    <aside className="selector-filter">
                        <FilterPanel
                            filters={filters}
                            updateFilter={updateFilter}
                            removeFilter={removeFilter}
                        />
                    </aside>

                    {/* POKEMON LIST */}
                    <main className="selector-pokemon">
                        <div className="pokemon-list-header">
                            <h2>Pokémon</h2>

                            <span>
                                {filteredPokemon.length} Pokémon
                            </span>
                        </div>

                        {filteredPokemon.length === 0 ? (
                            <div className="no-pokemon">
                                <p>
                                    Không tìm thấy Pokémon phù hợp.
                                </p>
                            </div>
                        ) : (
                            <div className="pokemon-selector-grid">
                                {filteredPokemon.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() =>
                                            selectPokemon(item)
                                        }
                                        disabled={selecting}
                                        className={
                                            selectedPokemon?.id ===
                                            item.id
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

                                        <span>
                                            {item.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </main>
                </div>

                {/* ERROR */}
                {error && (
                    <p className="selector-error">
                        Error: {error}
                    </p>
                )}
            </div>
        </div>
    );
}

export default PokemonSelector;