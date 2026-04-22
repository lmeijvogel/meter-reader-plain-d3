type Padding = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};

type Dimensions = {
    width: number;
    height: number;
};

type Store = {
    dimensions: Dimensions;

    padding: Padding;
    domain: number[];
    range: number[];
};

export const chartCanvas = () => {
    const store: Store = {
        padding: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
        },
        dimensions: {
            width: 100,
            height: 100
        },

        domain: [0, 100],
        range: [0, 100]
    };

    const api = {
        setPadding(padding: Padding) {
            store.padding = padding;

            return api;
        },

        setDimensions(dimensions: Dimensions) {
            store.dimensions = dimensions;

            return api;
        }
    };

    return api;
};
