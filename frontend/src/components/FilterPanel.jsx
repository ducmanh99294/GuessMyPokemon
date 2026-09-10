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

const DEFAULT_FILTERS = {
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
        // Update UI ngay lập tức thông qua GameRoom
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

                            const selected =
                                Number(
                                    filters.generation
                                ) === generation;

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

                                        if (selected) {
                                            handleRemoveFilter(
                                                "generation"
                                            );
                                        } else {
                                            handleUpdateFilter(
                                                "generation",
                                                generation
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
            </section>


            {/* =================================================
                EVOLUTION
            ================================================= */}

            <section>
                <h3>Evolution</h3>

                <div className="evolution-options">

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
                                    {forms} forms
                                </button>
                            );

                        }
                    )}

                </div>

            </section>


            {/* =================================================
                TYPE EFFECTIVENESS
            ================================================= */}

            <section className="effectiveness-section">

                <h3>Type Effectiveness</h3>

                <div className="effectiveness-grid-container">

                    <EffectivenessGrid
                        title="Effect"
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


                    {/* GENERATION */}

                    {filters.generation !== null &&
                        filters.generation !== undefined && (

                            <FilterChip
                                label={`Gen ${filters.generation}`}
                                onRemove={() =>
                                    handleRemoveFilter(
                                        "generation"
                                    )
                                }
                            />

                        )}


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
                            >

                                <input
                                    type="checkbox"
                                    checked={checked}
                                    data-type={type}
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