const API_URL = import.meta.env.VITE_API_URL;

export async function filterPokemon(filters = {}) {

    const params =
        new URLSearchParams();


    Object.entries(filters).forEach(
        ([key, value]) => {

            if (
                value === undefined ||
                value === null ||
                value === ""
            ) {
                return;
            }


            if (Array.isArray(value)) {

                if (value.length > 0) {

                    params.append(
                        key,
                        value.join(",")
                    );

                }

                return;
            }


            params.append(
                key,
                value
            );

        }
    );


    const response =
        await fetch(
            `${API_URL}/filter?${params.toString()}`
        );


    if (!response.ok) {
        throw new Error(
            "Failed to fetch Pokemon"
        );
    }


    return await response.json();
}