import { addDays, addHours, getDaysInMonth, isSameDay } from "date-fns";
import { MeasurementEntry } from "../models/MeasurementEntry";

export function padData(
    data: MeasurementEntry[],
    startDate: Date,
    periodSize: "day" | "month" | "year"
): MeasurementEntry[] {
    const result: MeasurementEntry[] = [];

    if (periodSize === "day") {
        for (let hour = 0; hour < 24; hour++) {
            const currentDate = addHours(startDate, hour);

            const existingElement = data.find(
                (element) => element.timestamp.getHours() === hour && isSameDay(element.timestamp, startDate)
            );

            if (existingElement) {
                result.push(existingElement);
            } else {
                result.push({ timestamp: currentDate, value: 0 });
            }
        }
        return result;
    }

    if (periodSize === "month") {
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

    // For year data, don't pad anything.
    return data;
}
