import { addDays, addHours, getDaysInMonth, isBefore, isSameDay } from "date-fns";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

/* This name is not really correct. On the one hand, it pads the data, but it also
 * aggregates it on the hour/day and makes sure that there are no values outside the expected range.
 */
export function padData(
    data: ValueWithTimestamp[],
    startDate: Date,
    unitSize: "hour" | "day" | "month"
): ValueWithTimestamp[] {
    if (unitSize === "hour") {
        return padHourlyData(startDate, data);
    }

    if (unitSize === "day") {
        return padDailyData(startDate, data);
    }

    // For year data, don't pad anything.
    return data;
}

function padHourlyData(startDate: Date, data: ValueWithTimestamp[]) {
    const result: ValueWithTimestamp[] = [];
    let currentDate: Date = startDate;

    /* This seems like a roundabout way of iterating over the hours in the day,
     * but it's better to do it like this (keep adding hours) instead of just going
     * over hour 0 to 23 because of Daylight Savings Time: The boundary dates have
     * 1 fewer or 1 more hour.
     */
    const dateAfter = addDays(startDate, 1);
    do {
        const existingElement = data.find(
            (element) =>
                element.timestamp.getHours() === currentDate.getHours() &&
                element.timestamp.getTimezoneOffset() === currentDate.getTimezoneOffset() &&
                isSameDay(element.timestamp, startDate)
        );

        if (existingElement) {
            result.push(existingElement);
        } else {
            result.push({ timestamp: currentDate, value: 0 });
        }

        currentDate = addHours(currentDate, 1);
    } while (isBefore(currentDate, dateAfter));

    return result;
}

function padDailyData(startDate: Date, data: ValueWithTimestamp[]) {
    const result: ValueWithTimestamp[] = [];

    for (let day = 0; day < getDaysInMonth(startDate); day++) {
        const currentDate = addDays(startDate, day);

        const existingElement = data.find(
            (element) =>
                element.timestamp.getDate() === day + 1 && element.timestamp.getMonth() === startDate.getMonth()
        );

        if (existingElement) {
            result.push(existingElement);
        } else {
            result.push({ timestamp: currentDate, value: 0 });
        }
    }

    return result;
}
