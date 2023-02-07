import { PeriodDescription } from "./PeriodDescription";
import { assertNever } from "../lib/assertNever";

export abstract class GraphDescription {
    constructor(protected readonly periodDescription: PeriodDescription) {}

    abstract readonly displayableUnit: string;

    get minY(): number {
        return 0;
    }

    abstract get maxY(): number;

    get tooltipValueFormat() {
        return ".2f";
    }

    // TODO: This should be unitSize because we use it to get the expected max per unit
    protected get period(): "year" | "month" | "day" {
        return this.periodDescription.period;
    }
}

export class GasGraphDescription extends GraphDescription {
    readonly displayableUnit = "m³";

    get maxY() {
        switch (this.period) {
            case "year":
                return 400;
            case "month":
                return 12;
            case "day":
                return 1;
            default:
                return assertNever(this.period);
        }
    }
}

export class EurosGraphDescription extends GraphDescription {
    readonly displayableUnit = "€";

    get maxY() {
        switch (this.period) {
            case "year":
                return 160;
            case "month":
                return 30;
            case "day":
                return 3;
            default:
                return assertNever(this.period);
        }
    }
}

export class StroomGraphDescription extends GraphDescription {
    readonly displayableUnit = "kWh";

    get minY() {
        return -this.maxY;
    }

    get maxY() {
        switch (this.period) {
            case "year":
                return 600;
            case "month":
                return 20;
            case "day":
                return 1;
            default:
                return assertNever(this.period);
        }
    }
}

export class GenerationGraphDescription extends GraphDescription {
    readonly displayableUnit = "kWh";

    get minY() {
        return 0;
    }

    get maxY() {
        switch (this.period) {
            case "year":
                return 600;
            case "month":
                return 20;
            case "day":
                return 1;
            default:
                return assertNever(this.period);
        }
    }
}

export class WaterGraphDescription extends GraphDescription {
    readonly displayableUnit = "L";

    get maxY() {
        switch (this.period) {
            case "year":
                return 30000;
            case "month":
                return 1500;
            case "day":
                return 200;
            default:
                return assertNever(this.period);
        }
    }

    get tooltipValueFormat() {
        return "d";
    }
}

export class CurrentPowerUsageGraphDescription extends GraphDescription {
    readonly displayableUnit = "W";

    get maxY() {
        return 3000; // We only support a single period anyway
    }

    get tooltipValueFormat() {
        return "d";
    }
}

export class TemperatuurGraphDescription extends GraphDescription {
    readonly fieldName = "temperatuur";

    readonly displayableUnit = "°C";

    override get minY() {
        return 18;
    }

    get maxY() {
        return 30;
    }

    get tooltipValueFormat() {
        return ".1f";
    }
}
