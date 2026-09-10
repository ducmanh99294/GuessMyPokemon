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
    pokemon = [], loading, onGuess, guessing, disabled, eliminatedIds = []
}) {
    const [batchSize, setBatchSize] = useState(getBatchSize());
    const [visibleCount, setVisibleCount] = useState(getBatchSize());

    // ⭐ theo dõi resize để đổi batch size mobile/desktop
    useEffect(() => {
        function handleResize() {
            const size = getBatchSize();
            setBatchSize(size);
        }

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // ⭐ reset về batch đầu mỗi khi danh sách pokemon thay đổi (lọc mới)
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
                onClick={() =>
                    setVisibleCount((prev) => prev + batchSize)
                }
            >
                Xem thêm ({pokemon.length - visibleCount} còn lại)
            </button>
        )}

        <div className="pokemon-list">
            {visiblePokemon.map((item) => (
                <PokemonCard
                    key={item.id}
                    pokemon={item}
                    onGuess={onGuess}
                    guessing={guessing}
                    disabled={disabled || eliminatedIds.includes(item.id)}
                    eliminated={eliminatedIds.includes(item.id)}
                />
            ))}
        </div>

    </div>
);
}

export default PokemonList;