import * as d3 from "d3";
import { endOfDay, addMinutes, getDaysInMonth } from "date-fns";
import { MonthDescription } from "./MonthDescription";
import { PeriodDescription, FULL_MONTH_NAMES } from "./PeriodDescription";

const DAYS_OF_WEEK = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

export class DayDescription extends PeriodDescription {
    readonly period = "day";
    readonly unitSize = "hour";

    readonly graphTickPositions = "between_values";

    year: number;
    month: number;
    day: number;

    /**
     * @param year The year
     * @param month The 0-based month
     * @param day The 1-based day
     */
    constructor(year: number, month: number, day: number) {
        super();
        this.year = year;
        this.month = month;
        this.day = day;
    }

    static fromDate(date: Date): DayDescription {
        return new DayDescription(date.getFullYear(), date.getMonth(), date.getDate());
    }

    previous() {
        const date = new Date(this.year, this.month, this.day - 1);

        return new DayDescription(date.getFullYear(), date.getMonth(), date.getDate());
    }

    next() {
        const date = new Date(this.year, this.month, this.day + 1);
        return new DayDescription(date.getFullYear(), date.getMonth(), date.getDate());
    }

    up(): MonthDescription {
        return new MonthDescription(this.year, this.month);
    }

    toUrl() {
        return `/day/${this.year}/${this.month + 1}/${this.day}`;
    }

    toTitle() {
        const date = new Date(this.year, this.month, this.day);

        return `${DAYS_OF_WEEK[date.getDay()]} ${this.day} ${FULL_MONTH_NAMES[this.month]} ${this.year}`;
    }

    toDate() {
        return new Date(this.year, this.month, this.day);
    }

    toShortTitle() {
        return `${this.day} ${FULL_MONTH_NAMES[this.month]} ${this.year}`;
    }

    protected relevantDateParts(date: Date): Date {
        return date;
    }

    static today() {
        const now = new Date();

        return new DayDescription(now.getFullYear(), now.getMonth(), now.getDate());
    }

    startOfPeriod(): Date {
        return new Date(this.year, this.month, this.day);
    }

    endOfPeriod(): Date {
        return endOfDay(this.startOfPeriod());
    }

    tickFormatString() {
        return "%-H";
    }

    timeFormatString(): string {
        return "%H:%M";
    }

    getExpectedDomainValues() {
        return d3.timeHour;
    }

    getChartTicks() {
        return this.getExpectedDomainValues().every(2)!;
    }

    shiftHalfTick(date: Date) {
        return addMinutes(date, -30);
    }

    atDate(_date: Date): DayDescription {
        return this; // HourDescription is not fully supported.
    }

    normalize(date: Date): Date {
        /* Using utcDate preserves the timezone of the current time. There
         * are two 02:00s after the last day of Daylight Savings Time, and they
         * should not be mapped to the same hour.
         */
        const utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours());

        return new Date(utcDate);
    }

    isValid() {
        if (!this.up().isValid()) {
            return false;
        }

        if (this.day < 1 || this.day > getDaysInMonth(this.startOfPeriod())) {
            return false;
        }

        return true;
    }
}
