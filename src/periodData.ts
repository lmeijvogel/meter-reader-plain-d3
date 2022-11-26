import * as d3 from "d3";
import { isEqual } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { barChart } from "./charts/barChart";
import { lineChart } from "./charts/lineChart";
import { usageAndGenerationBarChart } from "./charts/usageAndGenerationBarChart";
import { padData } from "./helpers/padData";
import { costsFor, PriceCategory } from "./helpers/PriceCalculator";
import { responseRowToValueWithTimestamp } from "./helpers/responseRowToValueWithTimestamp";
import { titleForCategory } from "./lib/titleForCategory";
import {
    GasGraphDescription,
    WaterGraphDescription,
    StroomGraphDescription,
    GraphDescription,
    GenerationGraphDescription,
    TemperatuurGraphDescription
} from "./models/GraphDescription";
import { DayDescription, PeriodDescription } from "./models/PeriodDescription";
import { UsageField } from "./models/UsageData";
import { ValueWithTimestamp } from "./models/ValueWithTimestamp";
import { initializeNavigation } from "./navigation";
import { setCardTitle } from "./vizCard";

const navigation = initializeNavigation(retrieveAndDrawPeriodCharts);

let previousPeriod: PeriodDescription | null = null;

initKeyboardListener(retrieveAndDrawPeriodCharts, () => previousPeriod);
import { initKeyboardListener } from "./initKeyboardListener";

const enabledGraphs: ("gas" | "stroom" | "water" | "temperature" | "generation")[] = [
    "gas",
    "stroom",
    "water",
    "temperature",
    "generation"
];

/* Store the requested period to prevent older requests "overtaking" newer requests and being rendered
 * when the newer ones should be rendered.
 */
let requestedStartOfPeriod: Date | null;

export function retrieveAndDrawPeriodCharts(periodDescription: PeriodDescription) {
    if (previousPeriod && periodDescription.equals(previousPeriod)) {
        return;
    }

    navigation.setPeriodDescription(periodDescription);

    const shouldClearCanvas = previousPeriod?.periodSize !== periodDescription.periodSize;

    async function fetchChartData(
        fieldName: UsageField,
        card: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
        prefer15MinInterval = false
    ): Promise<ValueWithTimestamp[] | "stale"> {
        card.classed("loading", true);

        try {
            requestedStartOfPeriod = periodDescription.startOfPeriod();

            let url = `/api/${fieldName}${periodDescription.toUrl()}`;

            if (prefer15MinInterval && periodDescription.periodSize === "day") {
                url = `${url}/15m`;
            }

            const response = await fetch(url);
            const json = await response.json();

            if (!isEqual(requestedStartOfPeriod, periodDescription.startOfPeriod())) {
                return "stale";
            }

            const data = json.map(responseRowToValueWithTimestamp);

            if (prefer15MinInterval) {
                return data;
            }

            return padData(data, periodDescription.startOfPeriod(), periodDescription.periodSize);
        } finally {
            card.classed("loading", false);
        }
    }

    if (enabledGraphs.includes("gas")) {
        const periodGasContainer = d3.select("#gas_period_data");

        fetchChartData("gas", periodGasContainer).then((values) => {
            if (values === "stale") {
                return;
            }

            const graphDescription = new GasGraphDescription(periodDescription);
            const api = barChart(periodDescription, graphDescription)
                .onClick(retrieveAndDrawPeriodCharts)
                .data(values)
                .color("#e73710");

            const cardTitle = createPeriodDataCardTitle(values, "gas", graphDescription, periodDescription);
            setCardTitle(periodGasContainer, cardTitle);

            api.call(periodGasContainer.select(".chart"));
        });
    }

    if (enabledGraphs.includes("water")) {
        const periodWaterContainer = d3.select("#water_period_data");

        fetchChartData("water", periodWaterContainer).then((values) => {
            if (values === "stale") {
                return;
            }

            const graphDescription = new WaterGraphDescription(periodDescription);
            const api = barChart(periodDescription, graphDescription)
                .onClick(retrieveAndDrawPeriodCharts)
                .clearCanvas(shouldClearCanvas)
                .data(values)
                .color("#428bca");

            const cardTitle = createPeriodDataCardTitle(values, "water", graphDescription, periodDescription);
            setCardTitle(periodWaterContainer, cardTitle);

            api.call(periodWaterContainer.select(".chart"));
        });
    }

    if (enabledGraphs.includes("generation")) {
        const periodGenerationContainer = d3.select("#generation_period_data");

        const fetchAggregate = (field: "mean" | "max") =>
            periodDescription instanceof DayDescription
                ? fetch(`/api/generation/aggregate/${field}${periodDescription.toUrl()}`)
                      .then((r) => r.json())
                      .then((r) =>
                          r.map((row: [number, number, number]) => {
                              const timestamp = new Date(
                                  Date.UTC(
                                      periodDescription.year,
                                      periodDescription.month,
                                      periodDescription.day,
                                      row[0],
                                      row[1]
                                  )
                              );

                              return { value: row[2] / 250, timestamp: utcToZonedTime(timestamp, "Europe/Amsterdam") };
                          })
                      )
                : Promise.resolve([]);

        Promise.all([
            fetchChartData("generation", periodGenerationContainer, true),
            fetchAggregate("mean"),
            fetchAggregate("max")
        ]).then(([generationValues, averagesValues, maxValues]) => {
            if (generationValues === "stale") {
                return;
            }

            const graphDescription = new GenerationGraphDescription(periodDescription);

            // The API returns Wh. I prefer to show the "average wattage".
            // When the periodSize === "day", values for every 15m are returned.
            // To convert these to kWh, we need to multiply by 4 (15m => 1h)
            // in addition to dividing by 1000.
            const kWMultiplicationFactor = periodDescription.periodSize === "day" ? 250 : 1000;
            const valuesInKW = generationValues.map((value) => ({ ...value, value: value.value / 1000 }));

            const valuesInKWhPer15m = generationValues.map((value) => ({
                ...value,
                value: value.value / kWMultiplicationFactor
            }));

            let api: any;
            if (periodDescription instanceof DayDescription) {
                api = lineChart(periodDescription, graphDescription)
                    .minMaxCalculation("minMax", "max")
                    .setSeries("opwekking", valuesInKWhPer15m, "#22aa08", {
                        positive: "#88ff28",
                        negative: "#ffffff" // The values will never be negative
                    })
                    .setSeries("gemiddelde", averagesValues, "#bbb")
                    .setSeries("max", maxValues, "#888");
            } else {
                api = barChart(periodDescription, graphDescription)
                    .data(valuesInKWhPer15m)
                    .onClick(retrieveAndDrawPeriodCharts);
            }

            api.clearCanvas(shouldClearCanvas);

            const cardTitle = createPeriodDataCardTitle(valuesInKW, "generation", graphDescription, periodDescription);

            setCardTitle(periodGenerationContainer, cardTitle);

            api.call(periodGenerationContainer.select(".chart"));
        });
    }

    if (enabledGraphs.includes("stroom")) {
        const periodStroomContainer = d3.select("#stroom_period_data");

        Promise.all<ValueWithTimestamp[] | "stale">([
            fetchChartData("stroom", periodStroomContainer),
            fetchChartData("generation", periodStroomContainer),
            fetchChartData("back_delivery", periodStroomContainer)
        ]).then(([stroomValues, generationValues, backDeliveryValues]) => {
            if (stroomValues === "stale" || generationValues === "stale" || backDeliveryValues === "stale") {
                return;
            }

            const graphDescription = new StroomGraphDescription(periodDescription);

            const equalizedData = {
                consumption: stroomValues,
                generation: generationValues.map((el) => ({ ...el, value: el.value / 1000 })),
                backDelivery: backDeliveryValues.map((el) => ({ ...el, value: -el.value }))
            };

            const api = usageAndGenerationBarChart(periodDescription, graphDescription)
                .onClick(retrieveAndDrawPeriodCharts)
                .clearCanvas(shouldClearCanvas)
                .data(equalizedData);

            const cardTitle = createPeriodDataCardTitle(stroomValues, "stroom", graphDescription, periodDescription);
            setCardTitle(periodStroomContainer, cardTitle);

            api.call(periodStroomContainer.select(".chart"));
        });
    }

    async function fetchTemperatureData(
        card: d3.Selection<d3.BaseType, unknown, HTMLElement, any>
    ): Promise<Map<string, ValueWithTimestamp[]>> {
        card.classed("loading", true);

        const url = periodDescription.toUrl();

        const result = new Map();

        try {
            const response = await fetch(`/api/temperature/living_room${url}`);
            const json: { [key: string]: ValueWithTimestamp[] } = await response.json();

            Object.entries(json).forEach((keyAndSeries) => {
                const [key, rawSeries] = keyAndSeries;
                const series = rawSeries.map(responseRowToValueWithTimestamp);

                result.set(key, series);
            });
        } finally {
            card.classed("loading", false);
        }

        return result;
    }

    if (enabledGraphs.includes("temperature")) {
        const card = d3.select("#temperature_line_chart");
        const chartContainer = card.select(".chart");
        setCardTitle(card, "Binnentemperatuur");

        fetchTemperatureData(card).then((result) => {
            const temperatureChart = lineChart(periodDescription, new TemperatuurGraphDescription(periodDescription))
                .minMaxCalculation("minMax")
                .clearCanvas(shouldClearCanvas);

            [
                ["huiskamer", "#ff0000"],
                ["zolder", "#0000ff"],
                ["tuinkamer", "#00ff00"]
            ].forEach((set) => {
                const [key, color] = set;
                const series = result.get(key);

                if (!!series) {
                    temperatureChart.setSeries(key, series, color);
                }
            });
            chartContainer.call(temperatureChart.call);
        });
    }

    previousPeriod = periodDescription;
}

function createPeriodDataCardTitle(
    values: ValueWithTimestamp[],
    priceCategory: PriceCategory | "generation",
    graphDescription: GraphDescription,
    periodDescription: PeriodDescription
): string {
    const usage = d3.sum(values, (v) => v.value);

    const categoryName = titleForCategory(priceCategory);

    const formattedAmount = d3.format(graphDescription.tooltipValueFormat)(usage);

    let result = `${categoryName}: ${formattedAmount} ${graphDescription.displayableUnit}`;

    /* Use "stroom" for generation price as long as we have "saldering" */
    const costs = costsFor(
        usage,
        priceCategory === "generation" ? "stroom" : priceCategory,
        periodDescription.startOfPeriod()
    );

    return result + ` (${costs})`;
}
