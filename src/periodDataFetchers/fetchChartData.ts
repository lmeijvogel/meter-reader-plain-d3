import { padData } from "../lib/padData";
import { responseRowToValueWithTimestamp } from "../lib/responseRowToValueWithTimestamp";
import { PeriodDescription } from "../models/periodDescriptions/PeriodDescription";
import { UsageField } from "../models/UsageData";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

export type ChartDataResult = {
    requestedPeriodDescription: PeriodDescription;
    result: ValueWithTimestamp[];
};

export async function fetchChartData(
    fieldName: UsageField,
    periodDescription: PeriodDescription,
    card: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
    prefer15MinInterval = false
): Promise<ChartDataResult> {
    card.classed("loading", true);

    try {
        let url = `/api/${fieldName}${periodDescription.toUrl()}`;

        // TODO: set unitSize to 15m?
        if (prefer15MinInterval && periodDescription.period === "day") {
            url = `${url}/15m`;
        }

        const response = await fetch(url);
        const json = await response.json();

        const data = json.map(responseRowToValueWithTimestamp);

        if (prefer15MinInterval && periodDescription.period === "day") {
            return {
                requestedPeriodDescription: periodDescription,
                result: data
            };
        }

        return {
            requestedPeriodDescription: periodDescription,
            result: padData(data, periodDescription.startOfPeriod(), periodDescription.unitSize)
        };
    } finally {
        card.classed("loading", false);
    }
}
