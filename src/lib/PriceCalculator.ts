import * as d3 from "d3";
import { isEqual, setHours } from "date-fns";
import { assertNever } from "../lib/assertNever";

export type PriceCategory = "gas" | "stroom" | "water";

export class Money {
    constructor(readonly euros: number) { }

    add(amount: number | Money): Money {
        if (amount instanceof Money) {
            return new Money(this.euros + amount.euros);
        }

        return new Money(this.euros + amount);
    }

    multiply(amount: number): Money {
        return new Money(this.euros * amount);
    }

    toString(): string {
        /*
         * To make calculations easier (with Math.floor(), etc.),
         * do the formatting on on the absolute value and then add a minus.
         */
        const absEuros = Math.abs(this.euros);

        const wholeEuros = Math.floor(absEuros);
        const cents = Math.floor(100 * (absEuros - wholeEuros));

        const paddedCents = cents < 10 ? `0${cents}` : cents;

        const minus = absEuros * this.euros < 0 ? -1 : 1;

        return `€ ${Intl.NumberFormat("nl-NL").format(wholeEuros * minus)},${paddedCents}`;
    }
}

type EnergyRateForDateRange = {
    gasPrice: Money;
    stroomPrice: Money;
    validFrom: Date;
    validUntil: Date;
};

type WaterRateForDateRange = {
    waterPrice: Money;
    validFrom: Date;
    validUntil: Date;
};

// Since new rates are added only once every two years,
// I think the effort of building a frontend for managing these
// rates won't be worth the effort :D
//
// All rates are in given in euros, but our Money class wants cents.
const energyPrices: EnergyRateForDateRange[] = [
    {
        gasPrice: new Money(0.267),
        stroomPrice: new Money(0.047),
        validFrom: new Date(2014, 0, 1),
        validUntil: new Date(2018, 10, 11)
    },
    {
        gasPrice: new Money(0.75336),
        stroomPrice: new Money(0.22652),
        validFrom: new Date(2018, 10, 12),
        validUntil: new Date(2019, 11, 25) // 25 december: End of current contract
    },
    {
        gasPrice: new Money(0.68358),
        stroomPrice: new Money(0.22035),
        validFrom: new Date(2019, 11, 26),
        validUntil: new Date(2022, 11, 26) // 25 december: End of current contract
    },
    /* Below are the "new" prices as of the war with Russia, raising energy prices and
     * removing the possibility of multi-year contracts.
     */
    {
        gasPrice: new Money(2.45874), // 1.93352 + 0.02988 + 0.00515 + 0.39591 + 0.09428,
        stroomPrice: new Money(0.61864), // This is the "enkeltarief" price.
        validFrom: new Date(2022, 11, 26),
        validUntil: new Date(2023, 3, 1) // 1 april: Variable prices
    },
    {
        gasPrice: new Money(1.76072), // 1.12868 + 0.03366 + 0.00572 + 0.59266
        stroomPrice: new Money(0.45184), // This is the "enkeltarief" price: 0.29939 + 0.15245
        validFrom: new Date(2023, 3, 1),
        validUntil: new Date(2024, 3, 1) // 1 april: Variable prices
    },
    {
        gasPrice: new Money(1.39889), // From contract
        stroomPrice: new Money(0.29740),
        validFrom: new Date(2024, 4, 1),
        validUntil: new Date(2027, 4, 1)
    }

];
// Incl. BTW. Rate is given on the Vandebron website in per m3, but I'd like to show in liters, so divide by 1000.
const waterPrices: WaterRateForDateRange[] = [
    {
        waterPrice: new Money((0.85 + 0.348) / 1000), // Not actually known
        validFrom: new Date(2014, 0, 1),
        validUntil: new Date(2020, 10, 16)
    },
    {
        waterPrice: new Money((0.85 + 0.348) / 1000),
        validFrom: new Date(2020, 10, 16),
        validUntil: new Date(2021, 0, 1)
    },
    {
        waterPrice: new Money((0.859 + 0.354) / 1000),
        validFrom: new Date(2021, 0, 1),
        validUntil: new Date(2022, 0, 1)
    },
    {
        waterPrice: new Money((0.863 + 0.35) / 1000),
        validFrom: new Date(2022, 0, 1),
        validUntil: new Date(2024, 11, 31) // Not known yet
    }
];

export class PriceCalculator {
    costsForMultiple(input: { value: number; timestamp: Date }[], priceCategory: PriceCategory): Money {
        const minTimestamp = d3.min(input, (element) => element.timestamp)!;
        const maxTimestamp = d3.max(input, (element) => element.timestamp)!;

        if (isEqual(setHours(minTimestamp, 0), setHours(maxTimestamp, 0))) {
            return this.costsFor(
                d3.sum(input, (el) => el.value),
                priceCategory,
                minTimestamp
            );
        }

        let total = new Money(0);

        for (const el of input) {
            total = total.add(this.costsFor(el.value, priceCategory, el.timestamp));
        }

        return total;
    }

    costsFor(units: number, priceCategory: PriceCategory, date: Date): Money {
        if (priceCategory === "water") {
            return this.waterRateForDate(date).waterPrice.multiply(units);
        }

        const currentRate = this.energyRateForDate(date);

        switch (priceCategory) {
            case "gas":
                return currentRate.gasPrice.multiply(units);
            case "stroom":
                return currentRate.stroomPrice.multiply(units);
            default:
                return assertNever(priceCategory);
        }
    }

    private waterRateForDate(date: Date): WaterRateForDateRange {
        const result = waterPrices.find((price) => price.validFrom <= date && date < price.validUntil);

        if (result) {
            return result;
        }

        console.error("No known prices for water, date: ", date);
        return {
            waterPrice: new Money(0),
            validFrom: new Date(2014, 0, 1),
            validUntil: new Date(2038, 0, 1)
        };
    }

    private energyRateForDate(date: Date): EnergyRateForDateRange {
        const result = energyPrices.find((price) => price.validFrom <= date && date < price.validUntil);

        if (result) {
            return result;
        }

        console.error("No known prices for energy, date: ", date);

        return {
            gasPrice: new Money(0),
            stroomPrice: new Money(0),
            validFrom: new Date(2014, 0, 1),
            validUntil: new Date(2038, 0, 1)
        };
    }
}
