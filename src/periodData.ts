import * as d3 from "d3";
import { barChart } from "./charts/barChart";
import { lineChart } from "./charts/lineChart";
import { usageAndGenerationBarChart } from "./charts/usageAndGenerationBarChart";
import { setCardTitle } from "./customElements/VizCard";
import { padData } from "./helpers/padData";
import { costsFor, PriceCategory } from "./helpers/PriceCalculator";
import { responseRowToMeasurementEntry } from "./helpers/responseRowToMeasurementEntry";
import { assertNever } from "./lib/assertNever";
import {
    GasGraphDescription,
    WaterGraphDescription,
    StroomGraphDescription,
    GraphDescription,
    GenerationGraphDescription,
    TemperatuurGraphDescription
} from "./models/GraphDescription";
import { MeasurementEntry } from "./models/MeasurementEntry";
import { DayDescription, PeriodDescription } from "./models/PeriodDescription";
import { UsageField } from "./models/UsageData";
import { initializeNavigation } from "./navigation";

const periodGasContainer = d3.select("#gas_period_data");
const periodStroomContainer = d3.select("#stroom_period_data");
const periodWaterContainer = d3.select("#water_period_data");
const periodGenerationContainer = d3.select("#generation_period_data");

const navigation = initializeNavigation(retrieveAndDrawPeriodCharts);

let previousPeriod: PeriodDescription | null = null;

const enabledGraphs: ("gas" | "stroom" | "water" | "temperature" | "generation")[] = [
    "gas",
    "stroom",
    "water",
    "temperature",
    "generation"
];

export function retrieveAndDrawPeriodCharts(periodDescription: PeriodDescription) {
    navigation.setPeriodDescription(periodDescription);

    const shouldClearCanvas = previousPeriod?.periodSize !== periodDescription.periodSize;

    async function fetchBarChartData(
        fieldName: UsageField,
        periodDescription: PeriodDescription
    ): Promise<MeasurementEntry[]> {
        const url = `/api/${fieldName}${periodDescription.toUrl()}`;

        const response = await fetch(url);
        const json = await response.json();
        const data = json.map(responseRowToMeasurementEntry);

        const paddedData = padData(data, periodDescription.startOfPeriod(), periodDescription.periodSize);

        return paddedData;
    }

    /* Fetching the line chart data is a bit different, because I want to force it
     * to use a 15m interval if the current period is a day. Copying and modifying it from above
     * is probably the easiest way.
     */
    async function fetchLineChartData(
        fieldName: UsageField,
        periodDescription: PeriodDescription
    ): Promise<MeasurementEntry[]> {
        const customWindow = periodDescription.periodSize === "day" ? "/15m" : "";
        const url = `/api/${fieldName}${periodDescription.toUrl()}${customWindow}`;

        const response = await fetch(url);
        const json = await response.json();
        return json.map(responseRowToMeasurementEntry);
    }

    if (enabledGraphs.includes("gas")) {
        fetchBarChartData("gas", periodDescription).then((values) => {
            const graphDescription = new GasGraphDescription(periodDescription);
            const api = barChart(periodDescription, graphDescription).onClick(retrieveAndDrawPeriodCharts).data(values);

            const cardTitle = createPeriodDataCardTitle(values, "gas", graphDescription, periodDescription);
            setCardTitle("js-period-gas-title", cardTitle);

            api.call(periodGasContainer);
        });
    }

    if (enabledGraphs.includes("water")) {
        fetchBarChartData("water", periodDescription).then((values) => {
            const graphDescription = new WaterGraphDescription(periodDescription);
            const api = barChart(periodDescription, graphDescription).onClick(retrieveAndDrawPeriodCharts).data(values);

            api.clearCanvas(shouldClearCanvas);

            const cardTitle = createPeriodDataCardTitle(values, "water", graphDescription, periodDescription);
            setCardTitle("js-period-water-title", cardTitle);

            api.call(periodWaterContainer);
        });
    }

    if (enabledGraphs.includes("generation")) {
        fetchLineChartData("generation", periodDescription).then((values) => {
            const graphDescription = new GenerationGraphDescription(periodDescription);

            // The API returns Wh. I prefer to show the "average wattage"show.
            // When the periodSize === "day", values for every 15m are returned.
            // To convert these to kWh, we need to multiply by 4 (15m => 1h)
            // in addition to dividing by 1000.
            const kWMultiplicationFactor = periodDescription.periodSize === "day" ? 250 : 1000;
            const valuesInKW = values.map((value) => ({ ...value, value: value.value / 1000 }));

            const valuesInKWhPer15m = values.map((value) => ({
                ...value,
                value: value.value / kWMultiplicationFactor
            }));

            let api: any;
            if (periodDescription instanceof DayDescription) {
                api = lineChart(periodDescription, graphDescription)
                    .minMaxCalculation("quantile")
                    .setSeries("opwekking", valuesInKWhPer15m, graphDescription.darkColor)
                    .fill(graphDescription.lightColor, "#ffffff"); // The values will never be negative
            } else {
                api = barChart(periodDescription, graphDescription)
                    .data(valuesInKWhPer15m)
                    .onClick(retrieveAndDrawPeriodCharts);
            }

            api.clearCanvas(shouldClearCanvas);

            const cardTitle = createPeriodDataCardTitle(valuesInKW, "generation", graphDescription, periodDescription);

            setCardTitle("js-period-generation-title", cardTitle);

            api.call(periodGenerationContainer);
        });
    }

    if (enabledGraphs.includes("stroom")) {
        Promise.all<MeasurementEntry[]>([
            fetchBarChartData("stroom", periodDescription),
            fetchBarChartData("generation", periodDescription),
            fetchBarChartData("back_delivery", periodDescription)
        ]).then(([stroomValues, generationValues, backDeliveryValues]) => {
            const graphDescription = new StroomGraphDescription(periodDescription);

            const equalizedData = {
                consumption: stroomValues,
                generation: generationValues.map((el) => ({ ...el, value: el.value / 1000 })),
                backDelivery: backDeliveryValues.map((el) => ({ ...el, value: -el.value }))
            };

            const api = usageAndGenerationBarChart(periodDescription, graphDescription)
                .onClick(retrieveAndDrawPeriodCharts)
                .data(equalizedData);

            api.clearCanvas(shouldClearCanvas);

            const cardTitle = createPeriodDataCardTitle(stroomValues, "stroom", graphDescription, periodDescription);
            setCardTitle("js-period-stroom-title", cardTitle);

            api.call(periodStroomContainer);
        });
    }

    async function fetchTemperatureData(
        periodDescription: PeriodDescription
    ): Promise<Map<string, MeasurementEntry[]>> {
        const url = periodDescription.toUrl();

        const response = await fetch(`/api/temperature/living_room${url}`);
        const json: { [key: string]: MeasurementEntry[] } = await response.json();

        const result = new Map();

        Object.entries(json).forEach((keyAndSeries) => {
            const [key, rawSeries] = keyAndSeries;
            const series = rawSeries.map(responseRowToMeasurementEntry);

            result.set(key, series);
        });

        return result;
    }

    if (enabledGraphs.includes("temperature")) {
        fetchTemperatureData(periodDescription).then((result) => {
            const chartContainer = d3.select("#temperature_line_chart");
            const temperatureChart = lineChart(
                periodDescription,
                new TemperatuurGraphDescription(periodDescription)
            ).minMaxCalculation("minMax");

            temperatureChart.clearCanvas(shouldClearCanvas);

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
    values: MeasurementEntry[],
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

function titleForCategory(priceCategory: PriceCategory | "generation"): string {
    let categoryName: string;

    switch (priceCategory) {
        case "gas":
            categoryName = "Gas";
            break;
        case "stroom":
            categoryName = "Stroom";
            break;
        case "water":
            categoryName = "Water";
            break;
        case "generation":
            categoryName = "Opwekking";
            break;
        default:
            assertNever(priceCategory);
    }
    return categoryName;
}
