const typeService = require("./typeService");

const EFFECTIVENESS = {
    NO_EFFECT: "no_effect",
    NOT_EFFECTIVE: "not_effective",
    EFFECTIVE: "effective",
    SUPER_EFFECTIVE: "super_effective"
};

const ALL_TYPES = [
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

async function getEffectiveness(attackType, defendingTypes) {
    const attackData = await typeService.getType(attackType);

    let multiplier = 1;

    for (const defendingType of defendingTypes) {
        if (attackData.doubleDamageTo.includes(defendingType)) {
            multiplier *= 2;
        }

        if (attackData.halfDamageTo.includes(defendingType)) {
            multiplier *= 0.5;
        }

        if (attackData.noDamageTo.includes(defendingType)) {
            multiplier = 0;
        }
    }

    return {
        multiplier,
        category: getCategory(multiplier)
    };
}

function getCategory(multiplier) {
    if (multiplier === 0) {
        return EFFECTIVENESS.NO_EFFECT;
    }

    if (multiplier < 1) {
        return EFFECTIVENESS.NOT_EFFECTIVE;
    }

    if (multiplier === 1) {
        return EFFECTIVENESS.EFFECTIVE;
    }

    return EFFECTIVENESS.SUPER_EFFECTIVE;
}

async function getAllEffectiveness(defendingTypes) {
    const result = {};

    for (const attackType of ALL_TYPES) {
        result[attackType] = await getEffectiveness(
            attackType,
            defendingTypes
        );
    }

    return result;
}

module.exports = {
    EFFECTIVENESS,
    getEffectiveness,
    getAllEffectiveness
};