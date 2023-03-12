import * as d3 from "d3";
import { endOfYear, addDays, startOfMonth } from "date-fns";
import { MonthDescription } from "./MonthDescription";
import { PeriodDescription } from "./PeriodDescription";

export class YearDescription extends PeriodDescription {
    readonly period = "year";
    readonly unitSize = "month";

    readonly graphTickPositions = "on_value";

    year: number;

    static thisYear(): YearDescription {
        return new YearDescription(new Date().getFullYear());
    }

    /**
     * @param year The year
     * @param month The 0-based month
     */
    constructor(year: number) {
        super();
        this.year = year;
    }

    previous() {
        return new YearDescription(this.year - 1);
    }

    next() {
        return new YearDescription(this.year + 1);
    }

    up() {
        return null;
    }

    toUrl() {
        return "/year/" + this.year;
    }

    toTitle() {
        return this.year.toString();
    }

    toDate() {
        return new Date(this.year, 0, 1);
    }

    protected relevantDateParts(date: Date): Date {
        return new Date(date.getFullYear(), 0, 0);
    }

    startOfPeriod(): Date {
        return new Date(this.year, 0, 1);
    }

    endOfPeriod(): Date {
        return endOfYear(this.startOfPeriod());
    }

    tickFormatString() {
        return "%m";
    }

    timeFormatString() {
        return "%Y";
    }
    getExpectedDomainValues() {
        return d3.timeMonth;
    }

    getChartTicks() {
        return this.getExpectedDomainValues();
    }

    shiftHalfTick(date: Date) {
        return addDays(date, -15);
    }

    atDate(date: Date): MonthDescription {
        return new MonthDescription(date.getFullYear(), date.getMonth());
    }

    atIndex(index: number) {
        return new MonthDescription(this.year, index - 1);
    }

    normalize(date: Date) {
        return startOfMonth(date);
    }

    isValid() {
        return true;
    }
}
