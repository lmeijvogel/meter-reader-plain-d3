import * as d3 from "d3";
import { differenceInMinutes } from "date-fns";
import { gauge } from "./charts/gauge";
import { lineChart } from "./charts/lineChart";
import {
    black,
    gaugeBadColor,
    gaugeGoodColor,
    gaugeMildColor,
    gaugeOkColor,
    gaugeVeryGoodColor,
    gaugeWorseColor,
    stroomGenerationColorForCurrentGraph,
    stroomUsageColorForCurrentGraph
} from "./colors";
import { mergeNewWithOldValues } from "./lib/mergeNewWithOldValues";
import { responseRowToValueWithTimestamp } from "./lib/responseRowToValueWithTimestamp";
import { createRowsWithCards } from "./lib/createRowsWithCards";
import { CurrentPowerUsageGraphDescription } from "./models/GraphDescription";
import { LastHourDescription } from "./models/PeriodDescription";
import { ValueWithTimestamp } from "./models/ValueWithTimestamp";
import { setCardTitle } from "./vizCard";

type CurrentFields = { current: ValueWithTimestamp[] };

export class CurrentDataTab {
    private _isInitialized = false;

    private readonly powerUsageGauge = gauge()
        .domain([-3000, 3000])
        .colors([
            { start: -3000, color: gaugeVeryGoodColor },
            { start: -2000, color: gaugeGoodColor },
            { start: -1000, color: gaugeOkColor },
            { start: 0, color: gaugeMildColor },
            { start: 1000, color: gaugeBadColor },
            { start: 2000, color: gaugeWorseColor }
        ]);

    private lastHourDescription = new LastHourDescription();
    private readonly recentCurrentGraph = lineChart(
        this.lastHourDescription,
        new CurrentPowerUsageGraphDescription(this.lastHourDescription)
    ).minMaxCalculation("quantile");

    private pageInvisibleTimestamp: Date | undefined;

    private powerGaugeTimer: NodeJS.Timer | undefined;
    private recentPowerGraphTimer: NodeJS.Timer | undefined;
    private readonly onDataReceived: (currentValueInW: number) => void;

    constructor(onDataReceived: (currentValueInW: number) => void) {
        this.onDataReceived = onDataReceived;
    }

    public get isInitialized(): boolean {
        return this._isInitialized;
    }

    initializeTab(elementId: string) {
        if (this._isInitialized) {
            return;
        }

        createRowsWithCards([["recent_current", "current_power_gauge"]], elementId);

        window.addEventListener("visibilitychange", () => {
            const pageVisible = document.visibilityState === "visible";

            if (pageVisible) {
                this.initializeCurrentCharts();
                this.startCurrentUsagePolling();
            } else {
                this.stopRecentPowerPolling();
                this.stopCurrentUsagePolling();
            }
        });

        this._isInitialized = true;
    }

    public async initializeCurrentCharts() {
        const pageVisible = document.visibilityState === "visible";

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
        }

        this.pageInvisibleTimestamp = undefined;

        if (!this.recentPowerGraphTimer) {
            this.recentPowerGraphTimer = setInterval(this.updatePowerUsageGraph, 5000);
        }
    }

    public startCurrentUsagePolling() {
        if (!this.powerGaugeTimer) {
            this.powerGaugeTimer = setInterval(this.getLatestPowerUsage, 1000);
        }
    }

    private stopCurrentUsagePolling() {
        if (this.powerGaugeTimer) {
            clearInterval(this.powerGaugeTimer);
            this.powerGaugeTimer = undefined;
        }
    }

    public stopRecentPowerPolling() {
        clearInterval(this.recentPowerGraphTimer);
        this.recentPowerGraphTimer = undefined;

        this.pageInvisibleTimestamp = new Date();
    }

    private retrievePowerUsage = async (minutes = 10) => {
        return fetch(`/api/stroom/recent?minutes=${minutes}`)
            .then((response) => response.json())
            .then((json) => {
                const fieldsKW: CurrentFields = {
                    current: json["current"].map(responseRowToValueWithTimestamp)
                };

                return fieldsKW;
            });
    };

    private retrieveLatestPowerUsage = async () => {
        return fetch("/api/stroom/last")
            .then((response) => response.json())
            .then((json) => {
                const fieldsKW: CurrentFields = {
                    current: json["current"].map(responseRowToValueWithTimestamp)
                };

                return fieldsKW;
            });
    };

    private powerUsage: CurrentFields = {
        current: []
    };

    private updatePowerUsageGraph = async (minutes: number = 1) => {
        const newValues = await this.retrievePowerUsage(minutes);

        this.powerUsage.current = mergeNewWithOldValues(newValues.current, this.powerUsage.current);

        this.drawPowerUsage(this.powerUsage);
    };

    private getLatestPowerUsage = async () => {
        const newValues = await this.retrieveLatestPowerUsage();

        const currentValueInW = newValues.current[0].value * 1000;

        this.updateCurrentUsageGauge(currentValueInW);
        this.onDataReceived(currentValueInW);
    };

    private drawPowerUsage(fieldsKW: CurrentFields) {
        const recentCurrentCard = d3.select("#recent_current");
        const recentCurrentContainer = recentCurrentCard.select(".chart");
        setCardTitle(recentCurrentCard, "Stroomverbruik laatste uur");

        const currentInW = fieldsKW.current.map((entry) => ({ ...entry, value: entry.value * 1000 }));

        this.recentCurrentGraph
            .setSeries("current", currentInW, black, {
                positive: stroomUsageColorForCurrentGraph,
                negative: stroomGenerationColorForCurrentGraph
            })
            .animate(false);

        recentCurrentContainer.call(this.recentCurrentGraph.call);
    }

    private updateCurrentUsageGauge(valueInW: number) {
        const gaugeCard = d3.select("#current_power_gauge");
        const gaugeContainer = gaugeCard.select(".chart");
        setCardTitle(gaugeCard, "Huidig stroomverbruik");

        this.powerUsageGauge.value(valueInW);

        gaugeContainer.call(this.powerUsageGauge.call);
    }
}
