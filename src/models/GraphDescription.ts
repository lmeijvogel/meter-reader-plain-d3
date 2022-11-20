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

    protected get periodSize(): "year" | "month" | "day" {
        return this.periodDescription.periodSize;
    }
}

export class GasGraphDescription extends GraphDescription {
    readonly displayableUnit = "m³";

    get maxY() {
        switch (this.periodSize) {
            case "year":
                return 400;
            case "month":
                return 12;
            case "day":
                return 1;
            default:
                return assertNever(this.periodSize);
        }
    }
}

export class StroomGraphDescription extends GraphDescription {
    readonly displayableUnit = "kWh";

    get minY() {
        return -this.maxY;
    }

    get maxY() {
        switch (this.periodSize) {
            case "year":
                return 600;
            case "month":
                return 20;
            case "day":
                return 1;
            default:
                return assertNever(this.periodSize);
        }
    }
}

export class GenerationGraphDescription extends GraphDescription {
    readonly displayableUnit = "kWh";

    get minY() {
        return 0;
    }

    get maxY() {
        switch (this.periodSize) {
            case "year":
                return 600;
            case "month":
                return 20;
            case "day":
                return 1;
            default:
                return assertNever(this.periodSize);
        }
    }
}

export class WaterGraphDescription extends GraphDescription {
    readonly displayableUnit = "L";

    get maxY() {
        switch (this.periodSize) {
            case "year":
                return 30000;
            case "month":
                return 1500;
            case "day":
                return 200;
            default:
                return assertNever(this.periodSize);
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
