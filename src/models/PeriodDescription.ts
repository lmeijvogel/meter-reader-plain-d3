import * as d3 from "d3";
import {
    addDays,
    addHours,
    addMinutes,
    addSeconds,
    endOfDay,
    endOfHour,
    endOfMonth,
    endOfYear,
    getDaysInMonth,
    isEqual,
    startOfDay,
    startOfMinute,
    startOfMonth,
    sub
} from "date-fns";

export type GraphTickPositions = "on_value" | "between_values";

const DAYS_OF_WEEK = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];

const FULL_MONTH_NAMES = [
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
    abstract readonly periodSize: "year" | "month" | "day";
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
        return this.periodSize === other.periodSize && isEqual(this.startOfPeriod(), other.startOfPeriod());
    }

    abstract startOfPeriod(): Date;
    abstract endOfPeriod(): Date;

    abstract atDate(date: Date): PeriodDescription;
    atIndex(_index: number): PeriodDescription {
        return this; // TODO: Fix in all subclasses
    }
}

export class YearDescription extends PeriodDescription {
    readonly periodSize = "year";
    readonly graphTickPositions = "on_value";

    year: number;

    static thisYear(): YearDescription {
        return new YearDescription(new Date().getFullYear());
    }

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

export class MonthDescription extends PeriodDescription {
    readonly periodSize = "month";
    readonly graphTickPositions = "on_value";

    year: number;
    month: number;

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

export class DayDescription extends PeriodDescription {
    readonly periodSize = "day";
    readonly graphTickPositions = "between_values";

    year: number;
    month: number;
    day: number;

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

export class HourDescription extends PeriodDescription {
    constructor(
        public readonly year: number,
        public readonly month: number,
        public readonly day: number,
        public readonly hour: number
    ) {
        super();
    }

    readonly periodSize = "day"; // TODO: Should not be used!
    readonly graphTickPositions = "on_value";

    toUrl() {
        return "";
    }
    toTitle() {
        return `${this.up().toTitle} ${this.hour}:00`;
    }
    toDate() {
        return new Date(this.year, this.month - 1, this.day, this.hour, 0);
    }

    previous() {
        this.warnNotSupported();
        return this;
    }
    next() {
        this.warnNotSupported();
        return this;
    }

    up(): DayDescription {
        return new DayDescription(this.year, this.month, this.day);
    }

    tickFormatString() {
        return "%M";
    }

    timeFormatString() {
        return "%a %Y-%m-%d %H:%M";
    }

    getExpectedDomainValues(): d3.TimeInterval {
        return d3.timeHour;
    }

    getChartTicks() {
        return this.getExpectedDomainValues();
    }

    shiftHalfTick(date: Date) {
        return addSeconds(date, -30);
    }

    hasMeasurements(): boolean {
        return !this.beforeFirstMeasurement() && !this.isInFuture();
    }

    beforeFirstMeasurement(): boolean {
        return this.relevantDateParts(this.toDate()) < this.relevantDateParts(firstMeasurementDate);
    }

    protected relevantDateParts(date: Date): Date {
        return date;
    }

    startOfPeriod() {
        return new Date(this.year, this.month - 1, this.day, this.hour, 0);
    }

    endOfPeriod() {
        return endOfHour(this.startOfPeriod());
    }

    atDate(date: Date) {
        return new MinuteDescription(date.getHours(), date.getMinutes());
    }

    toShortTitle() {
        const nextHour = (this.hour + 1) % 24;
        const hourDisplay = `${this.hour}:00-${nextHour}:00`;
        return `${hourDisplay}`;
    }

    private warnNotSupported() {
        console.warn("HourDescription is not a fully supported PeriodDescription.");
    }

    normalize(date: Date) {
        return startOfMinute(date);
    }
}

export class LastHourDescription extends HourDescription {
    constructor() {
        super(now().getFullYear(), now().getMonth(), now().getDate(), now().getHours());
    }

    override endOfPeriod() {
        return new Date();
    }

    override startOfPeriod() {
        return sub(this.endOfPeriod(), { hours: 1 });
    }

    timeFormatString() {
        return "%H:%M";
    }

    toShortTitle() {
        const nextHour = (this.hour + 1) % 24;
        const hourDisplay = `${this.hour}:00-${nextHour}:00`;
        return `${hourDisplay}`;
    }

    getChartTicks() {
        return d3.timeMinute.every(5)!;
    }

    isValid() {
        return true;
    }
}

export class MinuteDescription extends PeriodDescription {
    readonly periodSize = "day";

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

function now() {
    return new Date();
}

export function deserializePeriodDescription(input: any): PeriodDescription {
    switch (input.type) {
        case "DayDescription":
            return new DayDescription(input.year, input.month, input.day);
        case "MonthDescription":
            return new MonthDescription(input.year, input.month);
        case "YearDescription":
            return new YearDescription(input.year);
    }

    return DayDescription.today();
}

export function serializePeriodDescription(periodDescription: PeriodDescription): any {
    if (periodDescription instanceof DayDescription) {
        return {
            type: "DayDescription",
            year: periodDescription.year,
            month: periodDescription.month,
            day: periodDescription.day
        };
    }
    if (periodDescription instanceof MonthDescription) {
        return { type: "MonthDescription", year: periodDescription.year, month: periodDescription.month };
    }
    if (periodDescription instanceof YearDescription) {
        return { type: "YearDescription", year: periodDescription.year };
    }
}
