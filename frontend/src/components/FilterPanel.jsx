import { useState } from "react";
import socket from "../socket/socket";
import '../css/FilterPanel.css'
const TYPES = [
    "normal",
    "fire",
    "water",
    "electric",
    "grass",
    "ice",
    "fighting",
    "poison",
    "ground",
    "flying",
    "psychic",
    "bug",
    "rock",
    "ghost",
    "dragon",
    "dark",
    "steel",
    "fairy"
];

// Màu từng hệ (đồng bộ với CSS .active)
const TYPE_COLOR = {
    normal: "#A8A77A", fire: "#EE8130", water: "#6390F0",
    electric: "#E8B800", grass: "#6FAE4E", ice: "#7FC8C8",
    fighting: "#C22E28", poison: "#A33EA1", ground: "#D1A94F",
    flying: "#8E7CF0", psychic: "#F95587", bug: "#93A51A",
    rock: "#A1913B", ghost: "#735797", dragon: "#6F35FC",
    dark: "#5A4A3A", steel: "#9AA0B5", fairy: "#D685AD",
};

// Luôn trả về mảng (tương thích dữ liệu cũ đang lưu số đơn)
function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined || value === "") return [];
    return [value];
}

const DEFAULT_FILTERS = {
    type: [],
    name: "",
    generation: [],
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

function FilterPanel({
    filters = DEFAULT_FILTERS,
    updateFilter,
    removeFilter
}) {
    const [openEffect, setOpenEffect] = useState(null);

    /*
    =========================================================
    UPDATE FILTER
    =========================================================
    */

    function handleUpdateFilter(key, value) {
        // Update the UI immediately via GameRoom
        updateFilter(key, value);
    }

    /*
    =========================================================
    REMOVE FILTER
    =========================================================
    */

    function handleRemoveFilter(key) {
        const updatedFilters = {
            ...filters
        };

        if (Array.isArray(updatedFilters[key])) {
            updatedFilters[key] = [];
        } else {
            updatedFilters[key] = null;
        }

        updateFilter(key, updatedFilters[key]);
    }

    /*
    =========================================================
    CLEAR ALL FILTERS
    =========================================================
    */

    function clearFilters() {
        Object.keys(DEFAULT_FILTERS).forEach((key) => {
            updateFilter(
                key,
                Array.isArray(DEFAULT_FILTERS[key])
                    ? []
                    : null
            );
        });

        setOpenEffect(null);
    }

    /*
    =========================================================
    EFFECTIVENESS
    =========================================================
    */

    function toggleEffectiveness(effect, type) {
        const current = filters[effect] || [];

        const exists = current.includes(type);

        const updated = exists
            ? current.filter(
                (item) => item !== type
            )
            : [...current, type];

        if (updated.length === 0) {
            handleRemoveFilter(effect);
            return;
        }

        handleUpdateFilter(
            effect,
            updated
        );
    }

    return (
        <div className="filter-panel">

            <h2>Clues</h2>
{/* =================================================
    SEARCH BY NAME
================================================= */}

<section className="name-search-section">

    <h3>Search Pokémon</h3>

    <div className="name-search-wrapper">

        <input
            type="text"
            value={filters.name || ""}
            placeholder="Search by Pokémon name..."
            onChange={(e) =>
                handleUpdateFilter(
                    "name",
                    e.target.value
                )
            }
        />

        {filters.name && (
            <button
                type="button"
                className="clear-search"
                onClick={() =>
                    handleRemoveFilter("name")
                }
            >
                ×
            </button>
        )}

    </div>

</section>

            {/* =================================================
                TYPE
            ================================================= */}

            <section>
                <h3>Type</h3>

                <div className="type-grid">

                    {TYPES.map((type) => {

                        const selectedTypes =
                            filters.type || [];

                        const isSelected =
                            selectedTypes.includes(type);

                        return (
                            <button
                                key={type}
                                type="button"
                                data-type={type}
                                className={
                                    isSelected
                                        ? "active"
                                        : ""
                                }
                                onClick={() => {

                                    const updated =
                                        isSelected
                                            ? selectedTypes.filter(
                                                (item) =>
                                                    item !== type
                                            )
                                            : [
                                                ...selectedTypes,
                                                type
                                            ];

                                    if (
                                        updated.length === 0
                                    ) {
                                        handleRemoveFilter(
                                            "type"
                                        );
                                    } else {
                                        handleUpdateFilter(
                                            "type",
                                            updated
                                        );
                                    }

                                }}
                            >
                                <span
                                    className="type-dot"
                                    style={{ background: TYPE_COLOR[type] }}
                                />
                                {type}
                            </button>
                        );
                    })}

                </div>
            </section>


            {/* =================================================
                GENERATION
            ================================================= */}

            <section>
                <h3>Generation</h3>

                <div className="generation-grid">

                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(
                        (generation) => {

                            const selectedGens =
                                asArray(filters.generation).map(Number);

                            const selected =
                                selectedGens.includes(generation);

                            return (
                                <button
                                    key={generation}
                                    type="button"
                                    className={
                                        selected
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() => {

                                        const updated =
                                            selected
                                                ? selectedGens.filter(
                                                    (g) => g !== generation
                                                )
                                                : [
                                                    ...selectedGens,
                                                    generation
                                                ];

                                        if (
                                            updated.length === 0
                                        ) {
                                            handleRemoveFilter(
                                                "generation"
                                            );
                                        } else {
                                            handleUpdateFilter(
                                                "generation",
                                                updated
                                            );
                                        }

                                    }}
                                >
                                    Gen {generation}
                                </button>
                            );

                        }
                    )}

                </div>
            </section>


            {/* =================================================
                SPECIAL
            ================================================= */}

            <section>
                <h3>Special</h3>
                <div className="Special-grid">
                    <button
                        type="button"
                        className={
                            filters.legendary === true ||
                            filters.legendary === "true"
                                ? "active"
                                : ""
                        }
                        onClick={() => {

                            const active =
                                filters.legendary === true ||
                                filters.legendary === "true";

                            if (active) {
                                handleRemoveFilter(
                                    "legendary"
                                );
                            } else {
                                handleUpdateFilter(
                                    "legendary",
                                    true
                                );
                            }

                        }}
                    >
                        Legendary
                    </button>

                    <button
                        type="button"
                        className={
                            filters.mythical === true ||
                            filters.mythical === "true"
                                ? "active"
                                : ""
                        }
                        onClick={() => {

                            const active =
                                filters.mythical === true ||
                                filters.mythical === "true";

                            if (active) {
                                handleRemoveFilter(
                                    "mythical"
                                );
                            } else {
                                handleUpdateFilter(
                                    "mythical",
                                    true
                                );
                            }

                        }}
                    >
                        Mythical
                    </button>

                    <button
                        type="button"
                        className={
                            filters.mega === true || filters.mega === "true"
                                ? "active"
                                : ""
                        }
                        onClick={() => {
                            const active = filters.mega === true || filters.mega === "true";
                            if (active) {
                                handleRemoveFilter("mega");
                            } else {
                                handleUpdateFilter("mega", true);
                            }
                        }}
                    >
                        Mega
                    </button>
                </div>
            </section>


            {/* =================================================
                EVOLUTION
            ================================================= */}

            <section>
                <h3>Evolution</h3>

                <div className="evo-group">
                    <span className="evo-label">Can evolve</span>
                    <div className="evo-segment">

                    <button
                        type="button"
                        className={
                            filters.hasEvolution === true ||
                            filters.hasEvolution === "true"
                                ? "active"
                                : ""
                        }
                        onClick={() => {

                            const active =
                                filters.hasEvolution === true ||
                                filters.hasEvolution === "true";

                            if (active) {
                                handleRemoveFilter(
                                    "hasEvolution"
                                );
                            } else {
                                handleUpdateFilter(
                                    "hasEvolution",
                                    true
                                );
                            }

                        }}
                    >
                        Has Evolution
                    </button>

                    <button
                        type="button"
                        className={
                            filters.hasEvolution === false ||
                            filters.hasEvolution === "false"
                                ? "active"
                                : ""
                        }
                        onClick={() => {

                            const active =
                                filters.hasEvolution === false ||
                                filters.hasEvolution === "false";

                            if (active) {
                                handleRemoveFilter(
                                    "hasEvolution"
                                );
                            } else {
                                handleUpdateFilter(
                                    "hasEvolution",
                                    false
                                );
                            }

                        }}
                    >
                        No Evolution
                    </button>

                    </div>
                </div>

                <div className="evo-group">
                    <span className="evo-label">Number of forms</span>
                    <div className="evolution-forms">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(
                        (forms) => {

                            const selected =
                                Number(
                                    filters.evolutionForms
                                ) === forms;

                            return (
                                <button
                                    key={forms}
                                    type="button"
                                    className={
                                        selected
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() => {

                                        if (selected) {
                                            handleRemoveFilter(
                                                "evolutionForms"
                                            );
                                        } else {
                                            handleUpdateFilter(
                                                "evolutionForms",
                                                forms
                                            );
                                        }

                                    }}
                                >
                                    {forms}
                                </button>
                            );

                        }
                    )}

                    </div>
                </div>

            </section>


            {/* =================================================
                TYPE EFFECTIVENESS
            ================================================= */}

            <section className="effectiveness-section">

                <h3>Type Effectiveness</h3>

                <div className="effectiveness-grid-container">

                    <EffectivenessGrid
                        title="Normal"
                        icon=""
                        effect="effective"
                        filters={filters}
                        openEffect={openEffect}
                        setOpenEffect={setOpenEffect}
                        toggleEffectiveness={
                            toggleEffectiveness
                        }
                    />

                    <EffectivenessGrid
                        title="No Effect"
                        icon=""
                        effect="noEffect"
                        filters={filters}
                        openEffect={openEffect}
                        setOpenEffect={setOpenEffect}
                        toggleEffectiveness={
                            toggleEffectiveness
                        }
                    />

                    <EffectivenessGrid
                        title="Not Effect"
                        icon=""
                        effect="notEffect"
                        filters={filters}
                        openEffect={openEffect}
                        setOpenEffect={setOpenEffect}
                        toggleEffectiveness={
                            toggleEffectiveness
                        }
                    />

                    <EffectivenessGrid
                        title="Super Effect"
                        icon=""
                        effect="superEffect"
                        filters={filters}
                        openEffect={openEffect}
                        setOpenEffect={setOpenEffect}
                        toggleEffectiveness={
                            toggleEffectiveness
                        }
                    />

                </div>

            </section>


            {/* =================================================
                ACTIVE FILTERS
            ================================================= */}

            <section className="active-filters-section">

                <h3>Active Clues</h3>

                <div className="active-filters">

                    {/* NAME */}

                    {filters.name && (
                        <FilterChip
                            label={`Name: ${filters.name}`}
                            onRemove={() =>
                                handleRemoveFilter("name")
                            }
                        />
                    )}

                    {/* TYPE */}

                    {filters.type?.map((type) => (

                        <FilterChip
                            key={`type-${type}`}
                            label={`Type: ${type}`}
                            onRemove={() => {

                                const updated =
                                    filters.type.filter(
                                        (item) =>
                                            item !== type
                                    );

                                if (
                                    updated.length === 0
                                ) {
                                    handleRemoveFilter(
                                        "type"
                                    );
                                } else {
                                    handleUpdateFilter(
                                        "type",
                                        updated
                                    );
                                }

                            }}
                        />

                    ))}


                    {/* GENERATION (multi-select) */}

                    {asArray(filters.generation).map((gen) => (

                        <FilterChip
                            key={`gen-${gen}`}
                            label={`Gen ${gen}`}
                            onRemove={() => {

                                const updated =
                                    asArray(filters.generation)
                                        .map(Number)
                                        .filter(
                                            (g) => g !== Number(gen)
                                        );

                                if (
                                    updated.length === 0
                                ) {
                                    handleRemoveFilter(
                                        "generation"
                                    );
                                } else {
                                    handleUpdateFilter(
                                        "generation",
                                        updated
                                    );
                                }

                            }}
                        />

                    ))}


                    {/* LEGENDARY */}

                    {(filters.legendary === true ||
                        filters.legendary === "true") && (

                        <FilterChip
                            label="Legendary"
                            onRemove={() =>
                                handleRemoveFilter(
                                    "legendary"
                                )
                            }
                        />

                    )}


                    {/* MYTHICAL */}

                    {(filters.mythical === true ||
                        filters.mythical === "true") && (

                        <FilterChip
                            label="Mythical"
                            onRemove={() =>
                                handleRemoveFilter(
                                    "mythical"
                                )
                            }
                        />

                    )}

                    {/* MEGA */}
                    {(filters.mega === true || filters.mega === "true") && (
                        <FilterChip
                            label="Mega"
                            onRemove={() => handleRemoveFilter("mega")}
                        />
                    )}


                    {/* HAS EVOLUTION */}

                    {(filters.hasEvolution === true ||
                        filters.hasEvolution === "true") && (

                        <FilterChip
                            label="Has Evolution"
                            onRemove={() =>
                                handleRemoveFilter(
                                    "hasEvolution"
                                )
                            }
                        />

                    )}


                    {/* NO EVOLUTION */}

                    {(filters.hasEvolution === false ||
                        filters.hasEvolution === "false") && (

                        <FilterChip
                            label="No Evolution"
                            onRemove={() =>
                                handleRemoveFilter(
                                    "hasEvolution"
                                )
                            }
                        />

                    )}


                    {/* EVOLUTION FORMS */}

                    {filters.evolutionForms !== null &&
                        filters.evolutionForms !== undefined && (

                        <FilterChip
                            label={`${filters.evolutionForms} forms`}
                            onRemove={() =>
                                handleRemoveFilter(
                                    "evolutionForms"
                                )
                            }
                        />

                    )}


                    {/* EFFECTIVENESS */}

                    {[
                        {
                            key: "effective",
                            label: "Effect"
                        },
                        {
                            key: "noEffect",
                            label: "No Effect"
                        },
                        {
                            key: "notEffect",
                            label: "Not Effect"
                        },
                        {
                            key: "superEffect",
                            label: "Super Effect"
                        }
                    ].map(({ key, label }) => {

                        const selected =
                            filters[key] || [];

                        return selected.map(
                            (type) => (

                                <FilterChip
                                    key={`${key}-${type}`}
                                    label={`${label}: ${type}`}
                                    onRemove={() =>
                                        toggleEffectiveness(
                                            key,
                                            type
                                        )
                                    }
                                />

                            )
                        );

                    })}

                </div>

            </section>


            {/* =================================================
                CLEAR
            ================================================= */}

            <button
                type="button"
                onClick={clearFilters}
                className="clear-filters-button"
            >
                Clear Filters
            </button>

        </div>
    );
}


/* =========================================================
   EFFECTIVENESS GRID
========================================================= */

function EffectivenessGrid({
    title,
    effect,
    icon,
    filters,
    openEffect,
    setOpenEffect,
    toggleEffectiveness
}) {
    const selected =
        filters[effect] || [];

    const isOpen =
        openEffect === effect;

    return (
        <div className="effectiveness-grid">

            <button
                type="button"
                className={`effectiveness-header ${
                    selected.length > 0
                        ? "has-selection"
                        : ""
                }`}
                onClick={() => {

                    setOpenEffect(
                        isOpen
                            ? null
                            : effect
                    );

                }}
            >

                <span>
                    {icon} {title}
                </span>

                {selected.length > 0 && (

                    <span className="selected-count">
                        {selected.length}
                    </span>

                )}

            </button>


            {isOpen && (

                <div className="type-checkbox-list">

                    {TYPES.map((type) => {

                        const checked =
                            selected.includes(type);

                        return (

                            <label
                                key={type}
                                className="type-checkbox"
                                data-type={type}

                            >

                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                        toggleEffectiveness(
                                            effect,
                                            type
                                        )
                                    }
                                />

                                <span>
                                    {type}
                                </span>

                            </label>

                        );

                    })}

                </div>

            )}

        </div>
    );
}


/* =========================================================
   FILTER CHIP
========================================================= */

function FilterChip({
    label,
    onRemove
}) {
    return (
        <button
            type="button"
            className="filter-chip"
            onClick={onRemove}
        >
            {label} ×
        </button>
    );
}


export default FilterPanel;