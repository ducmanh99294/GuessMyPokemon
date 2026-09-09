import PokemonCard from "./PokemonCard";
import '../css/PokemonList.css'
function PokemonList({
    pokemon = [],
    loading = false,
    onGuess,
    guessing = false,
    disabled = false
}) {
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

    return (
        <div className="pokemon-list">

            {pokemon.map((item) => (
                <PokemonCard
                    key={item.id}
                    pokemon={item}
                    onGuess={onGuess}
                    guessing={guessing}
                    disabled={disabled}
                />
            ))}

        </div>
    );
}

export default PokemonList;