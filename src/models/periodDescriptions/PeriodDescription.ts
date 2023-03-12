import * as d3 from "d3";
import { isEqual } from "date-fns";

export type GraphTickPositions = "on_value" | "between_values";

export const FULL_MONTH_NAMES = [
    "januari",
    "februari",
    "maart",
    "april",
    "mei",
    "juni",
    "juli",
    "augustus",
    "september",
    "oktober",
    "november",
    "december"
];

const firstMeasurementDate = new Date(2014, 2, 3);

export abstract class PeriodDescription {
    abstract readonly period: "year" | "month" | "day";
    abstract readonly unitSize: "month" | "day" | "hour"; // Which single values for graphs
    abstract readonly graphTickPositions: GraphTickPositions;

    abstract toUrl(): string;
    abstract toTitle(): string;
    abstract toDate(): Date;

    abstract previous(): PeriodDescription;
    abstract next(): PeriodDescription;
    abstract up(): PeriodDescription | null;

    abstract getChartTicks(): d3.TimeInterval;
    abstract getExpectedDomainValues(): d3.TimeInterval;
    abstract normalize(date: Date): Date;

    abstract tickFormatString(): string;
    abstract timeFormatString(): string;

    abstract shiftHalfTick(date: Date): Date;

    hasMeasurements(): boolean {
        return !this.beforeFirstMeasurement() && !this.isInFuture();
    }

    beforeFirstMeasurement(): boolean {
        return this.relevantDateParts(this.toDate()) < this.relevantDateParts(firstMeasurementDate);
    }

    protected abstract relevantDateParts(date: Date): Date;

    isInFuture(): boolean {
        return this.toDate() > new Date();
    }

    abstract isValid(): boolean;

    toShortTitle(): string {
        return this.toTitle();
    }

    equals(other: PeriodDescription): boolean {
        return this.period === other.period && isEqual(this.startOfPeriod(), other.startOfPeriod());
    }

    abstract startOfPeriod(): Date;
    abstract endOfPeriod(): Date;

    abstract atDate(date: Date): PeriodDescription;

    atIndex(_index: number): PeriodDescription {
        return this; // TODO: Fix in all subclasses
    }
}
