import * as d3 from "d3";
import { isEqual } from "date-fns";
import { utcToZonedTime } from "date-fns-tz";
import { barChart, BarChartApi } from "./charts/barChart";
import { lineChart } from "./charts/lineChart";
import { usageAndGenerationBarChart } from "./charts/usageAndGenerationBarChart";
import { padData } from "./lib/padData";
import { PriceCalculator, PriceCategory } from "./lib/PriceCalculator";
import { JsonResponseRow, responseRowToValueWithTimestamp } from "./lib/responseRowToValueWithTimestamp";
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
import { initializeNavigation, NavigationApi } from "./navigation";
import { setCardTitle } from "./vizCard";
import { initKeyboardListener } from "./initKeyboardListener";
import {
    darkGenerationGraphColor,
    gasGraphColor,
    generationGraphColor,
    grey,
    lightGrey,
    stroomGenerationColor,
    temperatuurHuiskamerColor,
    temperatuurTuinkamerColor,
    temperatuurZolderColor,
    waterGraphColor,
    white
} from "./colors";
import { createRowsWithCards } from "./lib/createRowsWithCards";
import { Thermometer } from "./charts/thermometer";

type Graphs = "gas" | "stroom" | "water" | "temperature" | "generation";

const enabledGraphs: Graphs[] = ["gas", "stroom", "water", "temperature", "generation"];

export class PeriodDataTab {
    private navigation: NavigationApi | null = null;

    private periodDescription: PeriodDescription;

    private readonly priceCalculator = new PriceCalculator();

    /* Store the requested period to prevent older requests "overtaking" newer requests and being rendered
     * when the newer ones should be rendered.
     */
    private requestedStartOfPeriod: Date | null = null;
    private _isNavigationInitialized = false;

    wasLoaded = false;

    waterChartApi: BarChartApi;
    gasChartApi: BarChartApi;
    generationBarChartApi: BarChartApi;

    constructor(initialPeriod: PeriodDescription, private readonly updateLocation: (path: string) => void) {
        this.periodDescription = initialPeriod;

        const gasGraphDescription = new GasGraphDescription(this.periodDescription);
        const waterGraphDescription = new WaterGraphDescription(this.periodDescription);
        const generationGraphDescription = new GenerationGraphDescription(this.periodDescription);

        this.waterChartApi = barChart(this.periodDescription, waterGraphDescription)
            .onClick(this.retrieveAndDrawPeriodCharts)
            .color(waterGraphColor);

        this.gasChartApi = barChart(this.periodDescription, gasGraphDescription)
            .onClick(this.retrieveAndDrawPeriodCharts)
            .color(gasGraphColor);

        this.generationBarChartApi = barChart(this.periodDescription, generationGraphDescription)
            .onClick(this.retrieveAndDrawPeriodCharts)
            .color(stroomGenerationColor);

        initKeyboardListener(this.retrieveAndDrawPeriodCharts, () => this.periodDescription);
    }

    initializePage(selector: string) {
        document.querySelector(selector)!.innerHTML = this.html();
        createRowsWithCards(
            [
                ["gas_period_data", "stroom_period_data", "water_period_data"],
                ["generation_period_data", "temperature_line_chart"]
            ],
            "#periodDataRows"
        );
    }

    tabSelected() {
        this.initializeNavigation();
        this.retrieveAndDrawPeriodCharts(this.periodDescription);
    }

    initializeNavigation() {
        if (!this._isNavigationInitialized) {
            this.navigation = initializeNavigation(this.retrieveAndDrawPeriodCharts);

            /* Hide navigation by default */
            this.navigation.hide();
        }

        this._isNavigationInitialized = true;
    }

    retrieveAndDrawPeriodCharts = (periodDescription: PeriodDescription) => {
        this.updateLocation(`/period${periodDescription.toUrl()}`);

        if (this.wasLoaded && this.periodDescription && periodDescription.equals(this.periodDescription)) {
            return;
        }

        this.wasLoaded = true;

        /* This gets a special place because the temperature
         * is also used by the gas graph, and I don't want to retrieve
         * the data twice.
         */
        const temperatureCard = d3.select("#temperature_line_chart");
        const temperatureRequest = fetchTemperatureData(periodDescription, temperatureCard);

        this.navigation?.setPeriodDescription(periodDescription);

        const shouldClearCanvas = this.periodDescription?.period !== periodDescription.period;

        const fetchChartData = async (
            fieldName: UsageField,
            card: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
            prefer15MinInterval = false
        ): Promise<ValueWithTimestamp[] | "stale"> => {
            card.classed("loading", true);

            try {
                this.requestedStartOfPeriod = periodDescription.startOfPeriod();

                let url = `/api/${fieldName}${periodDescription.toUrl()}`;

                // TODO: set unitSize to 15m?
                if (prefer15MinInterval && periodDescription.period === "day") {
                    url = `${url}/15m`;
                }

                const response = await fetch(url);
                const json = await response.json();

                if (!isEqual(this.requestedStartOfPeriod, periodDescription.startOfPeriod())) {
                    return "stale";
                }

                const data = json.map(responseRowToValueWithTimestamp);

                if (prefer15MinInterval && periodDescription.period === "day") {
                    return data;
                }

                return padData(data, periodDescription.startOfPeriod(), periodDescription.unitSize);
            } finally {
                card.classed("loading", false);
            }
        };

        if (enabledGraphs.includes("gas")) {
            const periodGasContainer = d3.select("#gas_period_data");

            const temperatureDataFetcher = temperatureRequest;

            Promise.all([fetchChartData("gas", periodGasContainer), temperatureDataFetcher]).then((result) => {
                const [gasValues, temperatureValues] = result;
                if (gasValues === "stale") {
                    return;
                }

                const graphDescription = new GasGraphDescription(periodDescription);

                this.gasChartApi.clearCanvas(shouldClearCanvas).data(periodDescription, graphDescription, gasValues);
                const outsideTemperatures = temperatureValues.get("buiten");

                let thermometerContainer: d3.Selection<d3.BaseType, unknown, HTMLElement, any> =
                    periodGasContainer.select(".thermometer");

                thermometerContainer?.selectAll("*").remove();
                this.gasChartApi.removeLineData();

                // If there aren't enough temperature measurements (which happens when
                // KNMI didn't validate the measurements yet), the thermometer will show
                // incomplete data, so don't show it then.
                if (outsideTemperatures && outsideTemperatures.length > 12) {
                    if (periodDescription.period === "day") {
                        if (!thermometerContainer.node()) {
                            thermometerContainer = periodGasContainer.append("svg") as any;
                            thermometerContainer.attr("class", "thermometer");
                        }

                        const minimum = d3.min(outsideTemperatures, (el) => el.value) ?? 0;
                        const maximum = d3.max(outsideTemperatures, (el) => el.value) ?? 0;

                        new Thermometer(thermometerContainer).draw({ minimum, maximum });
                    } else {
                        this.gasChartApi.addLineData(
                            outsideTemperatures,
                            new TemperatuurGraphDescription(periodDescription)
                        );
                    }
                }

                const cardTitle = this.createPeriodDataCardTitle(gasValues, "gas", graphDescription);
                setCardTitle(periodGasContainer, cardTitle);

                this.gasChartApi.call(periodGasContainer.select(".chart"));
            });
        }

        if (enabledGraphs.includes("water")) {
            const periodWaterContainer = d3.select("#water_period_data");

            fetchChartData("water", periodWaterContainer).then((values) => {
                if (values === "stale") {
                    return;
                }

                const graphDescription = new WaterGraphDescription(periodDescription);

                const cardTitle = this.createPeriodDataCardTitle(values, "water", graphDescription);
                setCardTitle(periodWaterContainer, cardTitle);

                this.waterChartApi
                    .clearCanvas(shouldClearCanvas)
                    .data(periodDescription, graphDescription, values)
                    .call(periodWaterContainer.select(".chart"));
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

                                  return {
                                      value: row[2] / 250,
                                      timestamp: utcToZonedTime(timestamp, "Europe/Amsterdam")
                                  };
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
                // When the period === "day", values for every 15m are returned.
                // To convert these to kWh, we need to multiply by 4 (15m => 1h)
                // in addition to dividing by 1000.
                const kWMultiplicationFactor = periodDescription.period === "day" ? 250 : 1000;
                const valuesInKW = generationValues.map((value) => ({
                    ...value,
                    value: value.value / 1000
                }));

                const valuesInKWhPer15m = generationValues.map((value) => ({
                    ...value,
                    value: value.value / kWMultiplicationFactor
                }));

                let generationBarChartApi: any;
                if (periodDescription instanceof DayDescription) {
                    generationBarChartApi = lineChart(periodDescription, graphDescription)
                        .minMaxCalculation("minMax")
                        .setSeries("opwekking", valuesInKWhPer15m, darkGenerationGraphColor, {
                            positive: generationGraphColor,
                            negative: white // The values will never be negative
                        })
                        .setSeries("gemiddelde", averagesValues, lightGrey)
                        .setSeries("max", maxValues, grey)
                        .renderOutsideLightShading(true);
                } else {
                    generationBarChartApi = this.generationBarChartApi;
                    generationBarChartApi.data(periodDescription, graphDescription, valuesInKWhPer15m);
                }

                generationBarChartApi.clearCanvas(shouldClearCanvas);

                const cardTitle = this.createPeriodDataCardTitle(valuesInKW, "generation", graphDescription);

                setCardTitle(periodGenerationContainer, cardTitle);

                generationBarChartApi.call(periodGenerationContainer.select(".chart"));
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
                    generation: generationValues.map((el) => ({
                        ...el,
                        value: el.value / 1000
                    })),
                    backDelivery: backDeliveryValues.map((el) => ({
                        ...el,
                        value: -el.value
                    }))
                };

                const api = usageAndGenerationBarChart(periodDescription, graphDescription)
                    .onClick(this.retrieveAndDrawPeriodCharts)
                    .clearCanvas(shouldClearCanvas)
                    .data(equalizedData);

                const cardTitle = this.createPeriodDataCardTitle(stroomValues, "stroom", graphDescription);
                setCardTitle(periodStroomContainer, cardTitle);

                api.call(periodStroomContainer.select(".chart"));
            });
        }

        if (enabledGraphs.includes("temperature")) {
            const temperatureCard = d3.select("#temperature_line_chart");

            if (!temperatureCard.select(".thermometer").node()) {
                const thermometerCard = temperatureCard.select(".chart").append("g");
                thermometerCard.attr("class", "thermometer");
            }

            const chartContainer = temperatureCard.select(".chart");
            setCardTitle(temperatureCard, "Binnentemperatuur");

            temperatureRequest.then((result) => {
                const temperatureChart = lineChart(
                    periodDescription,
                    new TemperatuurGraphDescription(periodDescription)
                )
                    .minMaxCalculation("minMax")
                    .clearCanvas(shouldClearCanvas);

                [
                    ["huiskamer", temperatuurHuiskamerColor],
                    ["zolder", temperatuurZolderColor],
                    ["tuinkamer", temperatuurTuinkamerColor]
                ].forEach(([key, color]) => {
                    const series = result.get(key);

                    if (series) {
                        temperatureChart.setSeries(key, series, color);
                    }
                });
                chartContainer.call(temperatureChart.call);
            });
        }

        this.periodDescription = periodDescription;
    };

    private createPeriodDataCardTitle(
        values: ValueWithTimestamp[],
        priceCategory: PriceCategory | "generation",
        graphDescription: GraphDescription
    ): string {
        const usage = d3.sum(values, (v) => v.value);

        const categoryName = titleForCategory(priceCategory);

        const formattedAmount = d3.format(graphDescription.tooltipValueFormat)(usage);

        let result = `${categoryName}: ${formattedAmount} ${graphDescription.displayableUnit}`;

        /* Use "stroom" for generation price as long as we have "saldering" */
        const costs = this.priceCalculator.costsForMultiple(
            values,
            priceCategory === "generation" ? "stroom" : priceCategory
        );

        return result + ` (${costs})`;
    }

    private html(): string {
        /* Note: The 'periodDataRows' section must be inside the navigation overlay, because
         * otherwise it won't pick up the touch events for navigation.
         */
        return `
            <div id="js-navigate-overlay" class="navigationOverlay js-navigate-overlay">
                <div class="upButtonsContainer js-navigate-up js-buttons-top visible">
                    <button class="label"><i icon-name="chevron-up"></i></button>
                </div>
                <div class="title-container js-page-title-container">
                    <h1 class="pageTitle js-page-title"></h1>
                </div>
                <div class="sideButtonsContainer prevButton js-navigate-prev js-buttons-left">
                    <button class="label"><i icon-name="chevron-left"></i></button>
                </div>
                <section id="periodDataRows"></section>
                <div class="sideButtonsContainer forwardButtons js-buttons-right">
                    <div class="forwardButton nextButton js-navigate-next">
                        <button class="label"><i icon-name="chevron-right"></i></button>
                    </div>
                    <div class="forwardButton todayButton js-navigate-today">
                        <button class="label"><i icon-name="chevron-last"></i></button>
                    </div>
                </div>
            </div>
        `;
    }
}

async function fetchTemperatureData(
    periodDescription: PeriodDescription,
    card: d3.Selection<d3.BaseType, unknown, HTMLElement, any>
): Promise<Map<string, ValueWithTimestamp[]>> {
    card.classed("loading", true);

    const url = periodDescription.toUrl();

    const result = new Map();

    try {
        const response = await fetch(`/api/temperature/living_room${url}`);
        const json: { [key: string]: JsonResponseRow[] } = await response.json();

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
