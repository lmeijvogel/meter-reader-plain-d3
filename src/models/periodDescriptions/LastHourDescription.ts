import { addHours, sub, subHours } from "date-fns";
import { HourDescription } from "./HourDescription";

export class LastHourDescription extends HourDescription {
    constructor() {
        const now = new Date();

        super({ endOfPeriod: addHours(now, 1) });
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
        const nextHour = this._endOfPeriod.getHours();
        const currentHour = subHours(this._endOfPeriod, 1).getHours();

        const hourDisplay = `${currentHour}:00-${nextHour}:00`;

        return `${hourDisplay}`;
    }

    isValid() {
        return true;
    }
}
