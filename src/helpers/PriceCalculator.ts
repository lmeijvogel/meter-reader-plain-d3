import { assertNever } from "../lib/assertNever";

export type PriceCategory = "gas" | "stroom" | "water";

export class Money {
    constructor(private readonly euros: number) {}

    multiply(amount: number): Money {
        return new Money(this.euros * amount);
    }

    toString(): string {
        const wholeEuros = Math.floor(this.euros);
        const cents = Math.floor(100 * (this.euros - wholeEuros));

        const paddedCents = cents < 10 ? `0${cents}` : cents;
        return `€ ${Intl.NumberFormat("nl-NL").format(wholeEuros)},${paddedCents}`;
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
        gasPrice: new Money(1.93352 + 0.02988 + 0.00515 + 0.39591 + 0.09428),
        stroomPrice: new Money(0.61864), // This is the "enkeltarief" price.
        validFrom: new Date(2022, 11, 26),
        validUntil: new Date(2023, 2, 31) // 1 april: Variable prices
    }
];
// Incl. BTW. Rate is given on the Vandebron website in per m3, but I'd like to show in liters, so divide by 1000.
const waterPrices: WaterRateForDateRange[] = [
    {
        waterPrice: new Money((0.85 + 0.348) / 1000), // Not actually known
        validFrom: new Date(2014, 0, 1),
        validUntil: new Date(2018, 10, 11)
    },
    {
        waterPrice: new Money((0.85 + 0.348) / 1000),
        validFrom: new Date(2020, 10, 16),
        validUntil: new Date(2020, 11, 31)
    },
    {
        waterPrice: new Money((0.859 + 0.354) / 1000),
        validFrom: new Date(2020, 0, 1),
        validUntil: new Date(2021, 11, 31)
    },
    {
        waterPrice: new Money((0.863 + 0.35) / 1000),
        validFrom: new Date(2022, 0, 1),
        validUntil: new Date(2024, 11, 31) // Not known yet
    }
];

export function costsFor(units: number, priceCategory: PriceCategory, date: Date): Money {
    if (priceCategory === "water") {
        return rateForDate(date, waterPrices).waterPrice.multiply(units);
    }

    const currentRate = rateForDate(date, energyPrices);

    switch (priceCategory) {
        case "gas":
            return currentRate.gasPrice.multiply(units);
        case "stroom":
            return currentRate.stroomPrice.multiply(units);
        default:
            return assertNever(priceCategory);
    }
}

function rateForDate<T extends { validFrom: Date; validUntil: Date }>(date: Date, input: T[]): T {
    const result = input.filter((price) => price.validFrom <= date && date < price.validUntil);

    /* TODO: This type is awful! */
    if (result.length === 0) {
        console.error("No prices specified for the selected date");
        return {
            gasPrice: new Money(0),
            stroomPrice: new Money(0),
            waterPrice: new Money(0),
            validFrom: new Date(2014, 0, 1),
            validUntil: new Date(2038, 0, 1)
        } as unknown as T;
    }

    return result[0];
}
