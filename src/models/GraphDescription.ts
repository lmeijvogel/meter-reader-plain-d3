import { PeriodDescription } from "./PeriodDescription";
import { UsageField } from "../models/UsageData";
import { assertNever } from "../lib/assertNever";

export abstract class GraphDescription {
    constructor(protected readonly periodDescription: PeriodDescription) {}

    abstract readonly barColor: string;
    abstract readonly darkColor: string;
    abstract readonly lightColor: string;
    abstract readonly fieldName: UsageField | "temperatuur";

    abstract readonly displayableUnit: string;

    get minY(): number {
        return 0;
    }

    abstract get maxY(): number;

    get xLabelHeight(): number {
        switch (this.periodDescription.periodSize) {
            case "year":
                return 40;
            default:
                return 20;
        }
    }
    get hasTextLabels(): boolean {
        return this.periodDescription.periodSize === "year";
    }

    get tooltipValueFormat() {
        return ".2f";
    }

    protected get periodSize(): "year" | "month" | "day" {
        return this.periodDescription.periodSize;
    }
}

function range(start: number, end: number): number[] {
    const result = [];

    for (let n = start; n < end; n++) {
        result.push(n);
    }

    return result;
}

export class GasGraphDescription extends GraphDescription {
    readonly barColor = "#e73710";
    readonly lightColor = "#e73710";
    readonly darkColor = "#791d09";

    readonly fieldName = "gas";

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
    readonly barColor = "#f0ad4e";
    readonly lightColor = "#ffddad";
    readonly darkColor = "#784805";
    readonly fieldName = "stroom";
    readonly displayableUnit = "kWh";

    get maxY() {
        switch (this.periodSize) {
            case "year":
                return 600;
            case "month":
                return 20;
            case "day":
                return 2;
            default:
                return assertNever(this.periodSize);
        }
    }
}

export class WaterGraphDescription extends GraphDescription {
    readonly barColor = "#428bca";
    readonly lightColor = "#428bca";
    readonly darkColor = "#224767";
    readonly fieldName = "water";

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
    readonly barColor = "#f0ad4e";
    readonly lightColor = "#ffddad";
    readonly darkColor = "#f0ad4e";
    readonly fieldName = "stroom";
    readonly displayableUnit = "W";

    get maxY() {
        return 3000; // We only support a single period anyway
    }

    get tooltipValueFormat() {
        return "d";
    }
}

export class BinnenTemperatuurGraphDescription extends GraphDescription {
    readonly barColor = "#428bca";
    readonly lightColor = "#ffddad";
    readonly darkColor = "#428bca";
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
