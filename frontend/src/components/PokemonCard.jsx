import '../css/PokemonCard.css'

function PokemonCard({
    pokemon, onGuess, guessing, disabled, eliminated
}) {
    return (
        <div className="pokemon-card">

            {/* ID */}
            <div className="pokemon-id">
                #{String(pokemon.id).padStart(3, "0")}
            </div>

            {/* IMAGE */}
            <div className="pokemon-image">
                {pokemon.sprite ? (
                    <img
                        src={pokemon.sprite}
                        alt={pokemon.name}
                    />
                ) : (
                    <div>No Image</div>
                )}
            </div>

            {/* NAME */}
            <h3>
                {pokemon.name}
            </h3>

            {/* TYPES */}
            <div className="pokemon-types">

                {pokemon.types?.map((type) => (
                    <span
                        key={type}
                        className={`type type-${type}`}
                    >
                        {type}
                    </span>
                ))}

            </div>

            {/* GUESS */}
            <button
                type="button"
                className={`pokemon-card ${eliminated ? "eliminated" : ""}`}
                disabled={disabled || guessing || eliminated}
                onClick={() => onGuess?.(pokemon)}
            >
                {eliminated ? "Đã sai" : guessing ? "..." : "Guess"}
            </button>

        </div>
    );
}

export default PokemonCard;