import { PriceCalculator } from "../lib/PriceCalculator";

describe("PriceCalculator", () => {
    const priceCalculator = new PriceCalculator();

    describe("costsForMultiple", () => {
        it("returns the right costs for a single day", () => {
            const input = [
                {
                    value: 10,
                    timestamp: new Date(2022, 0, 1, 1)
                },
                {
                    value: 11,
                    timestamp: new Date(2022, 0, 1, 2)
                },
                {
                    value: 12,
                    timestamp: new Date(2022, 0, 1, 3)
                },
                {
                    value: 13,
                    timestamp: new Date(2022, 0, 1, 4)
                }
            ];

            const actual = priceCalculator.costsForMultiple(input, "gas");

            expect(actual.euros).toBeCloseTo(31.44468);
        });

        /* the same price for both days */
        it("returns the right costs when multiple days are involved", () => {
            const input = [
                {
                    value: 10,
                    timestamp: new Date(2022, 0, 1, 1)
                },
                {
                    value: 11,
                    timestamp: new Date(2022, 0, 1, 2)
                },
                {
                    value: 12,
                    timestamp: new Date(2022, 0, 1, 3)
                },
                {
                    value: 13,
                    timestamp: new Date(2022, 0, 2, 1)
                }
            ];

            const actual = priceCalculator.costsForMultiple(input, "gas");

            /* Same case as the 'costsFor' one */
            expect(actual.euros).toBeCloseTo(31.44468);
        });
    });
});
