import * as d3 from "d3";
import { barChart } from "./charts/barChart";
import { lineChart } from "./charts/lineChart";
import { usageAndGenerationBarChart } from "./charts/usageAndGenerationBarChart";
import { setCardTitle } from "./customElements/VizCard";
import { padData } from "./helpers/padData";
import { costsFor, PriceCategory } from "./helpers/PriceCalculator";
import { responseRowToMeasurementEntry } from "./helpers/responseRowToMeasurementEntry";
import {
    GasGraphDescription,
    WaterGraphDescription,
    StroomGraphDescription,
    GraphDescription,
    GenerationGraphDescription
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
export function retrieveAndDrawPeriodCharts(periodDescription: PeriodDescription) {
    navigation.setPeriodDescription(periodDescription);

    // PeriodUsage
    async function fetchPeriodData(
        fieldName: UsageField,
        periodDescription: PeriodDescription,
        shouldPadData: boolean = true
    ): Promise<MeasurementEntry[]> {
        const url = `/api/${fieldName}${periodDescription.toUrl()}`;

        const response = await fetch(url);
        const json = await response.json();
        const data = json.map(responseRowToMeasurementEntry);

        if (shouldPadData) {
            const paddedData = padData(data, periodDescription.startOfPeriod(), periodDescription.periodSize);

            return paddedData;
        }

        return data;
    }

    fetchPeriodData("gas", periodDescription).then((values) => {
        const graphDescription = new GasGraphDescription(periodDescription);
        const api = barChart(periodDescription, graphDescription).onClick(retrieveAndDrawPeriodCharts).data(values);

        const cardTitle = createPeriodDataCardTitle(values, "gas", graphDescription, periodDescription);
        setCardTitle("js-period-gas-title", cardTitle);

        api.call(periodGasContainer);
    });

    fetchPeriodData("water", periodDescription).then((values) => {
        const graphDescription = new WaterGraphDescription(periodDescription);
        const api = barChart(periodDescription, graphDescription).onClick(retrieveAndDrawPeriodCharts).data(values);

        const cardTitle = createPeriodDataCardTitle(values, "water", graphDescription, periodDescription);
        setCardTitle("js-period-water-title", cardTitle);

        api.call(periodWaterContainer);
    });

    fetchPeriodData("generation", periodDescription, false).then((values) => {
        const graphDescription = new GenerationGraphDescription(periodDescription);

        const api = lineChart(periodDescription)
            .minMaxCalculation("quantile")
            .tooltipDateFormat("%H:%M")
            .tooltipValueFormat("d")
            .tooltipDisplayableUnit("W")
            .setSeries("opwekking", values, graphDescription.darkColor)
            .fill(graphDescription.lightColor, "#ffffff"); // The values will never be negative

        setCardTitle("js-period-generation-title", "Opwekking");

        api.call(periodGenerationContainer);
    });

    Promise.all<MeasurementEntry[]>([
        fetchPeriodData("stroom", periodDescription),
        fetchPeriodData("generation", periodDescription),
        fetchPeriodData("back_delivery", periodDescription)
    ]).then(([stroomValues, generationValues, backDeliveryValues]) => {
        const graphDescription = new StroomGraphDescription(periodDescription);

        const equalizedData = {
            consumption: stroomValues,
            generation: generationValues.map((el) => ({ value: el.value / 1000, timestamp: el.timestamp })),
            backDelivery: backDeliveryValues.map((el) => ({ value: -el.value, timestamp: el.timestamp }))
        };

        const api = usageAndGenerationBarChart(periodDescription, graphDescription)
            .onClick(retrieveAndDrawPeriodCharts)
            .data(equalizedData);

        const cardTitle = createPeriodDataCardTitle(stroomValues, "stroom", graphDescription, periodDescription);
        setCardTitle("js-period-stroom-title", cardTitle);

        api.call(periodStroomContainer);
    });

    async function fetchTemperatureData(
        periodDescription: PeriodDescription
    ): Promise<Map<string, MeasurementEntry[]>> {
        const url = periodDescription.toUrl();

        const response = await fetch(`/api/temperature/living_room${url}`);
        const json: { [key: string]: MeasurementEntry[] } = await response.json();

        const result = new Map();

        Array.from(Object.entries(json)).forEach((keyAndSeries) => {
            const [key, rawSeries] = keyAndSeries;
            const series = rawSeries.map(responseRowToMeasurementEntry);

            result.set(key, series);
        });

        return result;
    }

    fetchTemperatureData(periodDescription).then((result) => {
        const chartContainer = d3.select("#temperature_line_chart");
        const temperatureChart = lineChart(periodDescription)
            .tooltipDateFormat(periodDescription.timeFormatString())
            .tooltipValueFormat(".1f")
            .tooltipDisplayableUnit("°C")
            .minMaxCalculation("minMax");

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

function createPeriodDataCardTitle(
    values: MeasurementEntry[],
    priceCategory: PriceCategory,
    graphDescription: GraphDescription,
    periodDescription: PeriodDescription
): string {
    const usage = values.map((v) => v.value).reduce((acc: number, el: number) => acc + el, 0);
    const costs = costsFor(usage, priceCategory, periodDescription.startOfPeriod());

    const categoryName = priceCategory === "gas" ? "Gas" : priceCategory === "stroom" ? "Stroom" : "Water";

    return `${categoryName}: ${d3.format(graphDescription.tooltipValueFormat)(usage)} ${
        graphDescription.displayableUnit
    } (${costs})`;
}
