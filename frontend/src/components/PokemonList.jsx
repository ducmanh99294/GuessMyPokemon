import { useEffect, useState } from "react";
import PokemonCard from "./PokemonCard";
import '../css/PokemonList.css'

const DESKTOP_BATCH = 24;
const MOBILE_BATCH = 10;
const MOBILE_BREAKPOINT = 768;

function getBatchSize() {
    if (typeof window === "undefined") return DESKTOP_BATCH;
    return window.innerWidth <= MOBILE_BREAKPOINT ? MOBILE_BATCH : DESKTOP_BATCH;
}

function PokemonList({
    pokemon = [],
    loading = false,
    onGuess,
    guessing = false,
    disabled = false,
    wrongGuesses = new Set() // ⭐ prop bị thiếu — thêm lại
}) {
    const [batchSize, setBatchSize] = useState(getBatchSize());
    const [visibleCount, setVisibleCount] = useState(getBatchSize());

    useEffect(() => {
        function handleResize() {
            setBatchSize(getBatchSize());
        }
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        setVisibleCount(batchSize);
    }, [pokemon, batchSize]);

    if (loading) {
        return (
            <div className="pokemon-list-message">
                Searching Pokémon...
            </div>
        );
    }

    if (pokemon.length === 0) {
        return (
            <div className="pokemon-list-message">
                No Pokémon match these clues.
            </div>
        );
    }

    const visiblePokemon = pokemon.slice(0, visibleCount);
    const hasMore = visibleCount < pokemon.length;

    return (
        <div className="pokemon-list-container">

            {hasMore && (
                <button
                    type="button"
                    className="pokemon-load-more"
                    onClick={() => setVisibleCount((prev) => prev + batchSize)}
                >
                    Xem thêm ({pokemon.length - visibleCount} còn lại)
                </button>
            )}

            <div className="pokemon-list">
                {visiblePokemon.map((item) => {
                    const isWrong = wrongGuesses.has(item.id); // ⭐ khôi phục logic disable

                    return (
                        <PokemonCard
                            key={item.id}
                            pokemon={item}
                            onGuess={onGuess}
                            guessing={guessing}
                            disabled={disabled || isWrong} // ⭐ disable nếu đã đoán sai
                            eliminated={isWrong} // ⭐ để PokemonCard style mờ/gạch
                        />
                    );
                })}
            </div>

        </div>
    );
}

export default PokemonList;