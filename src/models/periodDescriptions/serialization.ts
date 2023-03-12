import { DayDescription } from "./DayDescription";
import { MonthDescription } from "./MonthDescription";
import { PeriodDescription } from "./PeriodDescription";
import { YearDescription } from "./YearDescription";

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
