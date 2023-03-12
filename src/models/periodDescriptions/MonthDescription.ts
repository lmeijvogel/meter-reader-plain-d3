import * as d3 from "d3";
import { endOfMonth, addHours, startOfDay } from "date-fns";
import { DayDescription } from "./DayDescription";
import { PeriodDescription, FULL_MONTH_NAMES } from "./PeriodDescription";
import { YearDescription } from "./YearDescription";

export class MonthDescription extends PeriodDescription {
    readonly period = "month";
    readonly unitSize = "day";

    readonly graphTickPositions = "on_value";

    year: number;
    month: number;

    /**
     * @param year The year
     * @param month The 0-based month
     */
    constructor(year: number, month: number) {
        super();
        this.year = year;
        this.month = month;
    }

    static thisMonth() {
        const now = new Date();

        return new MonthDescription(now.getFullYear(), now.getMonth());
    }

    previous() {
        const date = new Date(this.year, this.month - 1, 1);

        return new MonthDescription(date.getFullYear(), date.getMonth());
    }

    next() {
        const date = new Date(this.year, this.month + 1, 1);

        return new MonthDescription(date.getFullYear(), date.getMonth());
    }

    up(): YearDescription {
        return new YearDescription(this.year);
    }

    toUrl() {
        return `/month/${this.year}/${this.month + 1}`;
    }

    toTitle() {
        return `${FULL_MONTH_NAMES[this.month]} ${this.year}`;
    }

    toDate() {
        return new Date(this.year, this.month, 1);
    }

    protected relevantDateParts(date: Date): Date {
        return new Date(date.getFullYear(), date.getMonth(), 0);
    }

    startOfPeriod(): Date {
        return new Date(this.year, this.month, 1);
    }

    endOfPeriod(): Date {
        return endOfMonth(this.startOfPeriod());
    }

    getExpectedDomainValues() {
        return d3.timeDay;
    }

    getChartTicks() {
        return this.getExpectedDomainValues().every(2)!;
    }

    shiftHalfTick(date: Date) {
        return addHours(date, -12);
    }

    tickFormatString() {
        return "%-d";
    }

    timeFormatString(): string {
        return "%a %d-%m-%Y";
    }

    atDate(date: Date): DayDescription {
        return new DayDescription(date.getFullYear(), date.getMonth(), date.getDate());
    }

    atIndex(index: number) {
        return new DayDescription(this.year, this.month, index);
    }

    normalize(date: Date) {
        return startOfDay(date);
    }

    isValid() {
        return 0 <= this.month && this.month <= 11;
    }
}
