import { PeriodDescription, GraphTickPositions } from "./PeriodDescription";

export class MinuteDescription extends PeriodDescription {
    readonly period = "day";
    readonly unitSize = "hour";

    constructor(private readonly hour: number, private readonly minute: number) {
        super();
    }

    graphTickPositions: GraphTickPositions = "on_value";

    toUrl(): string {
        throw new Error("Method not implemented.");
    }
    toTitle(): string {
        throw new Error("Method not implemented.");
    }
    toDate(): Date {
        throw new Error("Method not implemented.");
    }
    previous(): PeriodDescription {
        throw new Error("Method not implemented.");
    }
    next(): PeriodDescription {
        throw new Error("Method not implemented.");
    }
    up(): PeriodDescription | null {
        throw new Error("Method not implemented.");
    }
    getChartTicks(): d3.TimeInterval {
        throw new Error("Method not implemented.");
    }
    getExpectedDomainValues(): d3.TimeInterval {
        throw new Error("Method not implemented.");
    }
    normalize(_date: Date): Date {
        throw new Error("Method not implemented.");
    }

    tickFormatString(): string {
        throw new Error("Method not implemented.");
    }
    timeFormatString(): string {
        throw new Error("Method not implemented.");
    }

    shiftHalfTick(_date: Date): Date {
        throw new Error("Method not implemented.");
    }
    protected relevantDateParts(_date: Date): Date {
        throw new Error("Method not implemented.");
    }
    startOfPeriod(): Date {
        throw new Error("Method not implemented.");
    }
    endOfPeriod(): Date {
        throw new Error("Method not implemented.");
    }

    atDate(_date: Date): PeriodDescription {
        throw new Error("Method not implemented.");
    }

    toShortTitle() {
        return `${this.hour}:${this.minute}`;
    }

    isValid() {
        return true;
    }
}
