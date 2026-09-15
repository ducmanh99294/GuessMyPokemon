// import '../css/PokemonCard.css'

// function PokemonCard({
//     pokemon, onGuess, guessing, disabled, eliminated
// }) {
//     return (
//         <div className={`pokemon-card ${eliminated ? "eliminated" : ""}`}> 

//             {/* ID */}
//             <div className="pokemon-id">
//                 #{String(pokemon.id).padStart(3, "0")}
//             </div>

//             {/* IMAGE */}
//             <div className="pokemon-image">
//                 {pokemon.sprite ? (
//                     <img
//                         src={pokemon.sprite}
//                         alt={pokemon.name}
//                     />
//                 ) : (
//                     <div>No Image</div>
//                 )}
//             </div>

//             {/* NAME */}
//             <h3>
//                 {pokemon.name}
//             </h3>

//             {/* TYPES */}
//             <div className="pokemon-types">
//                 {pokemon.types?.map((type) => (
//                     <span
//                         key={type}
//                         className={`type type-${type}`}
//                     >
//                         {type}
//                     </span>
//                 ))}
//             </div>

//             {/* GUESS */}
//             <button
//                 type="button"
//                 className="pokemon-guess-btn"
//                 disabled={disabled || guessing || eliminated}
//                 onClick={() => onGuess?.(pokemon)}
//             >
//                 {eliminated ? "Đã sai" : guessing ? "..." : "Guess"}
//             </button>

//         </div>
//     );
// }

// export default PokemonCard;
import { useState } from "react";
import '../css/PokemonCard.css'

function PokemonCard({
    pokemon, onGuess, guessing, disabled, eliminated
}) {
    const types = pokemon.types || [];
    const isDual = types.length >= 2;

    const primarySrc = isDual
        ? `/patterns/dual/${types[0]}-${types[1]}.png`
        : `/patterns/mono/${types[0] || "normal"}.png`;

    const [bgSrc, setBgSrc] = useState(primarySrc);
    const [fallbackStep, setFallbackStep] = useState(0);

    function handleBgError() {
        if (isDual && fallbackStep === 0) {
            // ⭐ Bước 1: thử đảo thứ tự cặp (VD: flying-fire thay vì fire-flying)
            setBgSrc(`/patterns/dual/${types[1]}-${types[0]}.png`);
            setFallbackStep(1);
            return;
        }

        if (fallbackStep <= 1) {
            // ⭐ Bước 2: fallback về ảnh mono theo type đầu tiên
            setBgSrc(`/patterns/mono/${types[0] || "normal"}.png`);
            setFallbackStep(2);
            return;
        }

        // ⭐ Bước 3: hết cách, ẩn ảnh nền luôn (không vỡ layout)
        setBgSrc(null);
    }

    return (
        <div className={`pokemon-card ${eliminated ? "eliminated" : ""}`}>

            {bgSrc && (
                <img
                    className="pokemon-card-bg"
                    src={bgSrc}
                    alt=""
                    aria-hidden="true"
                    onError={handleBgError}
                />
            )}

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
                {types.map((type) => (
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
                className="pokemon-guess-btn"
                // disabled={disabled || guessing || eliminated}
                onClick={() => onGuess?.(pokemon)}
            >
                {/* {eliminated ? "Đã sai" : guessing ? "..." : "Guess"} */}
                {"Guess"}
            </button>

        </div>
    );
}

export default PokemonCard;