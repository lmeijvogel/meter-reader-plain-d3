import * as d3 from "d3";
import { addMinutes, differenceInMinutes } from "date-fns";
import { gauge } from "./charts/gauge";
import { lineChart } from "./charts/lineChart";
import {
    black,
    gaugeBadColor,
    gaugeGoodColor,
    gaugeMildColor,
    gaugeOkColor,
    gaugeVeryGoodColor,
    gaugeWaterHalf,
    gaugeWaterMin,
    gaugeWaterQuart,
    gaugeWaterThreeQuart,
    gaugeWorseColor,
    stroomGenerationColorForCurrentGraph,
    stroomUsageColorForCurrentGraph,
    waterGraphColor
} from "./colors";
import { mergeNewWithOldValues } from "./lib/mergeNewWithOldValues";
import { responseRowToValueWithTimestamp } from "./lib/responseRowToValueWithTimestamp";
import { createRowsWithCards } from "./lib/createRowsWithCards";
import { CurrentPowerUsageGraphDescription, CurrentWaterUsageGraphDescription } from "./models/GraphDescription";
import { ValueWithTimestamp } from "./models/ValueWithTimestamp";
import { setCardTitle } from "./vizCard";
import { HourDescription } from "./models/periodDescriptions/HourDescription";
import { LastHourDescription } from "./models/periodDescriptions/LastHourDescription";
import { barChart } from "./charts/barChart";

type CurrentFields = { current: ValueWithTimestamp[] };
type WaterFields = { water: ValueWithTimestamp[] };

export class CurrentDataTab {
    private readonly powerUsageGauge = gauge()
        .unit("W")
        .domain([-3000, 3000])
        .colors([
            { start: -3000, color: gaugeVeryGoodColor },
            { start: -2000, color: gaugeGoodColor },
            { start: -1000, color: gaugeOkColor },
            { start: 0, color: gaugeMildColor },
            { start: 1000, color: gaugeBadColor },
            { start: 2000, color: gaugeWorseColor }
        ]);

    private readonly waterUsageGauge = gauge()
        .unit("L/min")
        .domain([0, 40])
        .colors([
            { start: 0, color: gaugeWaterMin },
            { start: 10, color: gaugeWaterQuart },
            { start: 20, color: gaugeWaterHalf },
            { start: 30, color: gaugeWaterThreeQuart }
        ]);

    private lastHourDescription = new LastHourDescription();
    private readonly recentCurrentGraph = lineChart().minMaxCalculation("quantile");

    private readonly recentWaterGraph = barChart().color(waterGraphColor);

    private pageInvisibleTimestamp: Date | undefined;

    private gaugesTimer: NodeJS.Timer | undefined;
    private recentPowerGraphTimer: NodeJS.Timer | undefined;
    private recentWaterGraphTimer: NodeJS.Timer | undefined;

    constructor(
        private readonly onDataReceived: (values: { current: number; water: number }) => void,
        private readonly updateLocation: (newPath: string) => void
    ) { }

    initializePage(selector: string) {
        createRowsWithCards(
            [
                ["recent_current", "current_power_gauge"],
                ["recent_water", "current_water_gauge"]
            ],
            selector
        );

        window.addEventListener("visibilitychange", () => {
            const pageVisible = document.visibilityState === "visible";

            if (pageVisible) {
                this.initializeCurrentCharts();
                this.startGaugesPolling();
            } else {
                this.stopGraphsPolling();
                this.stopGaugesPolling();
            }
        });

        this.startGaugesPolling();
    }

    public async tabSelected() {
        this.updateLocation("/now");
        await this.initializeCurrentCharts();
    }

    private async initializeCurrentCharts() {
        const pageVisible = document.visibilityState === "visible";

        this.updateLocation("/now");

        /* This duplicates the check at the top, but we don't want the intervals
         * to be set if the page is loaded in the background.
         */
        if (!pageVisible) {
            return;
        }

        if (this.pageInvisibleTimestamp) {
            const minutesSinceLastLoad = differenceInMinutes(new Date(), this.pageInvisibleTimestamp);

            await this.updatePowerUsageGraph(minutesSinceLastLoad + 1);
        } else {
            /* This is the first page load, so load everything */
            await this.updatePowerUsageGraph(60);
            await this.updateWaterUsageGraph(60);
        }

        this.pageInvisibleTimestamp = undefined;

        if (!this.recentPowerGraphTimer) {
            this.recentPowerGraphTimer = setInterval(this.updatePowerUsageGraph, 5000);
            this.recentWaterGraphTimer = setInterval(this.updateWaterUsageGraph, 5000);
        }
    }

    public startGaugesPolling() {
        if (!this.gaugesTimer) {
            this.gaugesTimer = setInterval(this.updateGaugeData, 1000);
        }
    }

    private stopGaugesPolling() {
        if (this.gaugesTimer) {
            clearInterval(this.gaugesTimer);
            this.gaugesTimer = undefined;
        }
    }

    public stopGraphsPolling() {
        clearInterval(this.recentPowerGraphTimer);
        this.recentPowerGraphTimer = undefined;

        clearInterval(this.recentWaterGraphTimer);
        this.recentWaterGraphTimer = undefined;

        this.pageInvisibleTimestamp = new Date();
    }

    private retrievePowerUsage = async (minutes = 10) => {
        const response = await fetch(`/api/stroom/recent?minutes=${minutes}`);
        const json = await response.json();

        return {
            current: json.map((row: any) => ({
                timestamp: new Date(Date.parse(row.timestamp)),
                value: Number(row.power)
            }))
        };
    };

    private retrieveWaterUsage = async (minutes = 10) => {
        const response = await fetch(`/api/water/recent?minutes=${minutes}`);
        const json = await response.json();

        return {
            water: json.map(responseRowToValueWithTimestamp)
        };
    };

    /**
     * @returns the current in kW and water usage in L/min
     */
    private fetchGaugeData = async () => {
        const response = await fetch("/api/usage/last");
        const json = await response.json();

        return {
            current: Number(json["current"]),
            water: Number(json["water"])
        };
    };

    private powerUsage: CurrentFields = {
        current: []
    };

    private waterUsage: WaterFields = {
        water: []
    };

    private updatePowerUsageGraph = async (minutes = 1) => {
        const newValues = await this.retrievePowerUsage(minutes);
        (newValues.current as unknown[]).reverse();

        this.powerUsage.current = mergeNewWithOldValues(newValues.current, this.powerUsage.current);

        this.drawPowerUsage(this.powerUsage);
    };

    private updateWaterUsageGraph = async (minutes = 60) => {
        const newValues = await this.retrieveWaterUsage(minutes);

        this.waterUsage.water = newValues.water;

        this.drawWaterUsage(this.waterUsage);
    };

    private updateGaugeData = async () => {
        const newValues = await this.fetchGaugeData();

        const displayableValues = {
            current: newValues.current * 1000,
            water: newValues.water
        };

        this.updateGauge(displayableValues);
        this.onDataReceived(displayableValues);
    };

    private drawPowerUsage(fieldsKW: CurrentFields) {
        const recentCurrentCard = d3.select("#recent_current");
        const recentCurrentContainer = recentCurrentCard.select(".chart");
        setCardTitle(recentCurrentCard, "Stroomverbruik laatste uur");

        const currentInW = fieldsKW;

        this.recentCurrentGraph.setData(
            this.lastHourDescription,
            new CurrentPowerUsageGraphDescription(this.lastHourDescription),
            [{
                name: "current", values: currentInW.current, lineColor: black, fill: {
                    positive: stroomUsageColorForCurrentGraph,
                    negative: stroomGenerationColorForCurrentGraph
                }
            }])
            .animate(false);

        recentCurrentContainer.call(this.recentCurrentGraph.call);
    }

    private drawWaterUsage(water: WaterFields) {
        const recentWaterCard = d3.select("#recent_water");
        const recentWaterContainer = recentWaterCard.select(".chart");
        setCardTitle(recentWaterCard, "Watergebruik");

        const waterData = water.water.filter((el) => el.value > 0);

        const lastElement = water.water.at(0);
        if (!lastElement) {
            return;
        }

        const graphDescription = new CurrentWaterUsageGraphDescription(this.lastHourDescription);

        // Add 1 minute because the scale is non-inclusive at the end,
        // causing the last measurement to fall off.
        const endOfPeriod = addMinutes(lastElement.timestamp, 1);

        this.recentWaterGraph.data(
            new HourDescription({ endOfPeriod }),
            graphDescription,
            waterData
        );

        recentWaterContainer.call(this.recentWaterGraph.call);
    }

    private updateGauge(value: { current: number; water: number }) {
        const currentGaugeCard = d3.select("#current_power_gauge");
        const currentGaugeContainer = currentGaugeCard.select(".chart");
        setCardTitle(currentGaugeCard, "Huidig stroomgebruik");

        this.powerUsageGauge.value(value.current);

        currentGaugeContainer.call(this.powerUsageGauge.call);

        const waterGaugeCard = d3.select("#current_water_gauge");
        const waterGaugeContainer = waterGaugeCard.select(".chart");
        setCardTitle(waterGaugeCard, "Huidig watergebruik");

        this.waterUsageGauge.value(value.water);

        waterGaugeContainer.call(this.waterUsageGauge.call);
    }
}
