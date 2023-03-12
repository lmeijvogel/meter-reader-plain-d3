import * as d3 from "d3";
import { addSeconds, subHours, startOfMinute } from "date-fns";
import { DayDescription } from "./DayDescription";
import { MinuteDescription } from "./MinuteDescription";
import { PeriodDescription } from "./PeriodDescription";

export class HourDescription extends PeriodDescription {
    protected _endOfPeriod: Date;

    constructor(props: { endOfPeriod: Date }) {
        super();

        this._endOfPeriod = props.endOfPeriod;
    }

    readonly period = "day"; // TODO: Should not be used!
    readonly unitSize = "hour"; // TODO: Should not be used!

    readonly graphTickPositions = "on_value";

    toUrl() {
        return "";
    }
    toTitle() {
        return `${this.up().toTitle} ${this._endOfPeriod.getHours()}:${this._endOfPeriod}.getMinutes()}`;
    }

    toDate() {
        return this._endOfPeriod;
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
        return new DayDescription(
            this._endOfPeriod.getFullYear(),
            this._endOfPeriod.getMonth(),
            this._endOfPeriod.getDate()
        );
    }

    tickFormatString() {
        return "%H:%M";
    }

    timeFormatString() {
        return "%a %Y-%m-%d %H:%M";
    }

    getExpectedDomainValues(): d3.TimeInterval {
        return d3.timeMinute.every(5)!;
    }

    getChartTicks(): d3.TimeInterval {
        return this.getExpectedDomainValues();
    }

    shiftHalfTick(date: Date) {
        return addSeconds(date, -30);
    }

    protected relevantDateParts(date: Date): Date {
        return date;
    }

    startOfPeriod() {
        return subHours(this._endOfPeriod, 1);
    }

    endOfPeriod() {
        return this._endOfPeriod;
    }

    atDate(date: Date) {
        return new MinuteDescription(date.getHours(), date.getMinutes());
    }

    toShortTitle() {
        const nextHour = this._endOfPeriod.getHours();
        const hourDisplay = `${subHours(this._endOfPeriod, 1)}:00-${nextHour}:00`;
        return `${hourDisplay}`;
    }

    private warnNotSupported() {
        console.warn("HourDescription is not a fully supported PeriodDescription.");
    }

    normalize(date: Date) {
        return startOfMinute(date);
    }

    isValid() {
        if (!this.up().isValid()) {
            return false;
        }

        const hour = subHours(this._endOfPeriod, 1).getHours();
        return 0 <= hour && hour <= 23;
    }
}
