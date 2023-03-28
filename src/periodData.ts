import * as d3 from "d3";
import { isEqual } from "date-fns";
import { barChart, BarChartApi } from "./charts/barChart";
import { lineChart, LineChartApi } from "./charts/lineChart";
import { usageAndGenerationBarChart } from "./charts/usageAndGenerationBarChart";
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
import { ValueWithTimestamp } from "./models/ValueWithTimestamp";
import { initializeNavigation, NavigationApi } from "./navigation";
import { setCardTitle, setCardTitleRaw } from "./vizCard";
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
    white,
} from "./colors";
import { createRowsWithCards } from "./lib/createRowsWithCards";
import { Thermometer } from "./charts/thermometer";
import { PeriodDescription } from "./models/periodDescriptions/PeriodDescription";
import { ChartDataResult, fetchChartData } from "./periodDataFetchers/fetchChartData";
import { DayDescription } from "./models/periodDescriptions/DayDescription";
import { utcToZonedTime } from "date-fns-tz";

type Graphs = "gas" | "stroom" | "water" | "temperature" | "generation";

const enabledGraphs: Graphs[] = ["gas", "stroom", "water", "temperature", "generation"];

type EqualizedStroomData = {
    consumption: ValueWithTimestamp[];
    generation: {
        value: number;
        timestamp: Date;
    }[];
    backDelivery: {
        value: number;
        timestamp: Date;
    }[];
};

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

    private readonly waterChartApi: BarChartApi;
    private readonly gasChartApi: BarChartApi;
    private readonly generationBarChartApi: BarChartApi;
    private readonly temperatureChartApi: LineChartApi;

    private readonly thermometer = new Thermometer();

    constructor(initialPeriod: PeriodDescription, private readonly updateLocation: (path: string) => void) {
        this.periodDescription = initialPeriod;

        const gasGraphDescription = new GasGraphDescription(this.periodDescription);
        const waterGraphDescription = new WaterGraphDescription(this.periodDescription);
        const generationGraphDescription = new GenerationGraphDescription(this.periodDescription);
        const temperatureGraphDescription = new TemperatuurGraphDescription(this.periodDescription);

        this.waterChartApi = barChart(this.periodDescription, waterGraphDescription)
            .onClick(this.retrieveAndDrawPeriodCharts)
            .color(waterGraphColor);

        this.gasChartApi = barChart(this.periodDescription, gasGraphDescription)
            .onClick(this.retrieveAndDrawPeriodCharts)
            .color(gasGraphColor);

        this.generationBarChartApi = barChart(this.periodDescription, generationGraphDescription)
            .onClick(this.retrieveAndDrawPeriodCharts)
            .color(stroomGenerationColor);

        this.temperatureChartApi = lineChart(this.periodDescription, temperatureGraphDescription).minMaxCalculation(
            "minMax"
        );

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

        this.requestedStartOfPeriod = periodDescription.startOfPeriod();

        if (enabledGraphs.includes("gas")) {
            this.fetchAndDrawGasChart(periodDescription, temperatureRequest, shouldClearCanvas);
        }

        if (enabledGraphs.includes("water")) {
            const periodWaterContainer = d3.select("#water_period_data");

            fetchChartData("water", periodDescription, periodWaterContainer).then((values) => {
                if (!this.isMeasurementValid(values)) {
                    return;
                }

                const graphDescription = new WaterGraphDescription(periodDescription);

                const cardTitle = this.createPeriodDataCardTitle(values.result, "water", graphDescription);
                setCardTitle(periodWaterContainer, cardTitle);

                this.waterChartApi
                    .clearCanvas(shouldClearCanvas)
                    .data(periodDescription, graphDescription, values.result)
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
                fetchChartData("generation", periodDescription, periodGenerationContainer, true),
                fetchAggregate("mean"),
                fetchAggregate("max")
            ]).then(([generationValues, averagesValues, maxValues]) => {
                if (!this.isMeasurementValid(generationValues)) {
                    return;
                }

                const graphDescription = new GenerationGraphDescription(periodDescription);

                // The API returns Wh. I prefer to show the "average wattage".
                // When the period === "day", values for every 15m are returned.
                // To convert these to kWh, we need to multiply by 4 (15m => 1h)
                // in addition to dividing by 1000.
                const kWMultiplicationFactor = periodDescription.period === "day" ? 250 : 1000;
                const valuesInKW = generationValues.result.map((value) => ({
                    ...value,
                    value: value.value / 1000
                }));

                const valuesInKWhPer15m = generationValues.result.map((value) => ({
                    ...value,
                    value: value.value / kWMultiplicationFactor
                }));

                let generationBarChartApi: any;

                if (periodDescription instanceof DayDescription) {
                    generationBarChartApi = lineChart(periodDescription, graphDescription)
                        .minMaxCalculation("minMax")
                        .setSeries("opwekking", valuesInKWhPer15m, darkGenerationGraphColor, 1, {
                            positive: generationGraphColor,
                            negative: white // The values will never be negative
                        })
                        .setSeries("gemiddelde", averagesValues, lightGrey, 1)
                        .setSeries("max", maxValues, grey, 1)
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

            Promise.all<ChartDataResult>([
                fetchChartData("stroom", periodDescription, periodStroomContainer),
                fetchChartData("generation", periodDescription, periodStroomContainer),
                fetchChartData("back_delivery", periodDescription, periodStroomContainer)
            ]).then(([stroomValues, generationValues, backDeliveryValues]) => {
                const allValid = [stroomValues, generationValues, backDeliveryValues].every(values => this.isMeasurementValid(values));

                if (!allValid) {
                    return;
                }

                const graphDescription = new StroomGraphDescription(periodDescription);

                const equalizedData: EqualizedStroomData = {
                    consumption: stroomValues.result,
                    generation: generationValues.result.map((el) => ({
                        ...el,
                        value: el.value / 1000
                    })),
                    backDelivery: backDeliveryValues.result.map((el) => ({
                        ...el,
                        value: -el.value
                    }))
                };

                const api = usageAndGenerationBarChart(periodDescription, graphDescription)
                    .onClick(this.retrieveAndDrawPeriodCharts)
                    .clearCanvas(shouldClearCanvas)
                    .data(equalizedData);

                const cardTitle = this.createStroomGraphCardTitle(equalizedData, "stroom", graphDescription);
                setCardTitleRaw(periodStroomContainer, cardTitle, "stroomCardTitle");

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
                const graphDescription = new TemperatuurGraphDescription(periodDescription);

                this.temperatureChartApi.periodDescription(periodDescription).graphDescription(graphDescription);

                [
                    ["huiskamer", temperatuurHuiskamerColor],
                    ["zolder", temperatuurZolderColor],
                    ["tuinkamer", temperatuurTuinkamerColor]
                ].forEach(([key, color]) => {
                    const series = result.get(key);

                    if (series) {
                        this.temperatureChartApi.setSeries(key, series, color);
                    }
                });
                chartContainer.call(this.temperatureChartApi.call);
            });
        }

        this.periodDescription = periodDescription;
    };

    private fetchAndDrawGasChart(periodDescription: PeriodDescription, temperatureRequest: Promise<Map<string, ValueWithTimestamp[]>>, shouldClearCanvas: boolean) {
        const periodGasContainer = d3.select("#gas_period_data");

        Promise.all([fetchChartData("gas", periodDescription, periodGasContainer), temperatureRequest]).then((result) => {
            const [gasValues, temperatureValues] = result;

            if (!this.isMeasurementValid(gasValues)) {
                return;
            }

            const graphDescription = new GasGraphDescription(periodDescription);

            this.gasChartApi.clearCanvas(shouldClearCanvas).data(periodDescription, graphDescription, gasValues.result);
            const outsideTemperatures = temperatureValues.get("buiten");

            let thermometerContainer = periodGasContainer.select(".thermometer");

            if (periodDescription.period === "day") {
                if (!thermometerContainer.node()) {
                    thermometerContainer = periodGasContainer.append("svg") as any;
                    thermometerContainer.attr("class", "thermometer");
                    this.thermometer.prepare(thermometerContainer);
                    this.thermometer.hide(thermometerContainer);
                }
            } else {
                this.thermometer.hide(thermometerContainer);
            }

            this.gasChartApi.removeLineData();

            // If there aren't enough temperature measurements (which happens when
            // KNMI didn't validate the measurements yet), the thermometer will show
            // incomplete data, so don't show it then.
            if (outsideTemperatures && outsideTemperatures.length > 12) {
                if (periodDescription.period === "day") {
                    const minimum = d3.min(outsideTemperatures, (el) => el.value) ?? 0;
                    const maximum = d3.max(outsideTemperatures, (el) => el.value) ?? 0;

                    this.thermometer.show(thermometerContainer);
                    this.thermometer.draw({ minimum, maximum }, thermometerContainer);
                } else {
                    this.thermometer.hide(thermometerContainer);
                    this.gasChartApi.addLineData(
                        outsideTemperatures,
                        new TemperatuurGraphDescription(periodDescription)
                    );
                }
            } else {
                this.thermometer.hide(thermometerContainer);
            }

            const cardTitle = this.createPeriodDataCardTitle(gasValues.result, "gas", graphDescription);
            setCardTitle(periodGasContainer, cardTitle);

            this.gasChartApi.call(periodGasContainer.select(".chart"));
        });
    }

    private isMeasurementValid(values: ChartDataResult) {
        if (!this.requestedStartOfPeriod) {
            return false;
        }

        return isEqual(this.requestedStartOfPeriod, values.requestedPeriodDescription.startOfPeriod());
    }

    private createStroomGraphCardTitle(
        equalizedData: EqualizedStroomData,
        priceCategory: PriceCategory,
        graphDescription: GraphDescription
    ) {
        const totalConsumption = this.formatPrice(
            equalizedData,
            "consumption",
            "Levering",
            priceCategory,
            graphDescription
        );
        const totalBackDelivery = this.formatPrice(
            equalizedData,
            "backDelivery",
            "Teruglevering",
            priceCategory,
            graphDescription
        );

        const consumptionPrice = this.priceCalculator.costsForMultiple(equalizedData.consumption, priceCategory);
        const backDeliveryCredit = this.priceCalculator.costsForMultiple(equalizedData.backDelivery, priceCategory);
        console.log({ consumptionPrice, backDeliveryCredit });

        const netUsage =
            d3.sum(equalizedData.consumption, (v) => v.value) + d3.sum(equalizedData.backDelivery, (v) => v.value);

        const netCosts = consumptionPrice.add(backDeliveryCredit);

        return `<section class="stroomCardData">
                  ${totalConsumption}
                  ${totalBackDelivery}
                  <div class="netUsageCaption">Netto:</div><div class="number netUsageAmount">${d3.format(
                      graphDescription.tooltipValueFormat
                  )(netUsage)} ${
            graphDescription.displayableTotalsUnit
        }</div><div class="number netUsageCosts">(${netCosts})</div>
                </section>`;
    }

    formatPrice(
        data: EqualizedStroomData,
        field: keyof EqualizedStroomData,
        caption: string,
        priceCategory: PriceCategory,
        graphDescription: GraphDescription
    ): string {
        const total = d3.sum(data[field], (v) => v.value);
        console.log({ field, total });

        const formattedAmount = d3.format(graphDescription.tooltipValueFormat)(total);

        const costs = this.priceCalculator.costsForMultiple(data[field], priceCategory);

        return `<div class="${field}Caption">${caption}:</div><div class="number ${field}Amount">${formattedAmount} ${graphDescription.displayableTotalsUnit}</div><div class="number ${field}Costs">(${costs})</div>`;
    }

    private createPeriodDataCardTitle(
        values: ValueWithTimestamp[],
        priceCategory: PriceCategory | "generation",
        graphDescription: GraphDescription
    ): string {
        const usage = d3.sum(values, (v) => v.value);

        const categoryName = titleForCategory(priceCategory);

        const formattedAmount = d3.format(graphDescription.tooltipValueFormat)(usage);

        let result = `${categoryName}: ${formattedAmount} ${graphDescription.displayableTotalsUnit}`;

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
                <section id="periodDataRows"></section>
                <div class="upButtonsContainer js-navigate-up js-buttons-top visible">
                    <button class="label"><i icon-name="chevron-up"></i></button>
                </div>
                <div class="title-container js-page-title-container">
                    <h1 class="pageTitle js-page-title"></h1>
                </div>
                <div class="sideButtonsContainer prevButton js-navigate-prev js-buttons-left">
                    <button class="label"><i icon-name="chevron-left"></i></button>
                </div>
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
