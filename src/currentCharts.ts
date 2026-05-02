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
    gaugeWorseColor,
    gasGraphColor,
    stroomGenerationColorForCurrentGraph,
    stroomUsageColorForCurrentGraph,
} from "./colors";
import { mergeNewWithOldValues } from "./lib/mergeNewWithOldValues";
import { createRowsWithCards } from "./lib/createRowsWithCards";
import { CurrentPowerUsageGraphDescription, CurrentGasUsageGraphDescription } from "./models/GraphDescription";
import { ValueWithTimestamp } from "./models/ValueWithTimestamp";
import { setCardTitle } from "./vizCard";
import { HourDescription } from "./models/periodDescriptions/HourDescription";
import { LastHourDescription } from "./models/periodDescriptions/LastHourDescription";
import { barChart } from "./charts/barChart";

type CurrentFields = { current: ValueWithTimestamp[] };
type GasFields = { gas: ValueWithTimestamp[] };

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

    private lastHourDescription = new LastHourDescription();
    private readonly recentCurrentGraph = lineChart().minMaxCalculation("quantile");
    private readonly recentGasGraph = barChart().color(gasGraphColor);

    private pageInvisibleTimestamp: Date | undefined;

    private gaugesTimer: NodeJS.Timer | undefined;
    private recentPowerGraphTimer: NodeJS.Timer | undefined;
    private recentGasGraphTimer: NodeJS.Timer | undefined;

    constructor(
        private readonly onDataReceived: (values: { current: number; water: number }) => void,
        private readonly updateLocation: (newPath: string) => void
    ) { }

    initializePage(selector: string) {
        createRowsWithCards(
            [
                ["recent_current", { id: "current_power_gauge", svg: true }],
                ["recent_gas"]
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

        if (!pageVisible) {
            return;
        }

        if (this.pageInvisibleTimestamp) {
            const minutesSinceLastLoad = differenceInMinutes(new Date(), this.pageInvisibleTimestamp);
            await this.updatePowerUsageGraph(minutesSinceLastLoad + 1);
        } else {
            await this.updatePowerUsageGraph(60);
        }
        await this.updateGasUsageGraph();

        this.pageInvisibleTimestamp = undefined;

        if (!this.recentPowerGraphTimer) {
            this.recentPowerGraphTimer = setInterval(this.updatePowerUsageGraph, 5000);
            this.recentGasGraphTimer = setInterval(this.updateGasUsageGraph, 60000);
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

        clearInterval(this.recentGasGraphTimer);
        this.recentGasGraphTimer = undefined;

        this.pageInvisibleTimestamp = new Date();
    }

    private retrievePowerUsage = async (minutes = 10) => {
        const response = await fetch(`/api/stroom/recent?minutes=${minutes}`);
        if (!response.ok) throw new Error(`Failed to fetch power usage: ${response.status}`);
        const json = await response.json();

        return {
            current: json.map((row: any) => ({
                timestamp: new Date(Date.parse(row.timestamp)),
                value: Number(row.power)
            }))
        };
    };

    // TODO: replace with real API fetch when backend is ready
    private retrieveGasUsage = async (): Promise<ValueWithTimestamp[]> => {
        const now = new Date();
        const snap = (minutesAgo: number): Date => {
            const t = new Date(now.getTime() - minutesAgo * 60 * 1000);
            t.setSeconds(0, 0);
            t.setMinutes(Math.floor(t.getMinutes() / 10) * 10);
            return t;
        };
        return [
            { timestamp: snap(430), value: 0.052 },
            { timestamp: snap(420), value: 0.081 },
            { timestamp: snap(410), value: 0.043 },
            { timestamp: snap(130), value: 0.031 },
            { timestamp: snap(120), value: 0.067 },
            { timestamp: snap(110), value: 0.058 },
        ];
    };

    private fetchGaugeData = async () => {
        const response = await fetch("/api/usage/last");
        if (!response.ok) throw new Error(`Failed to fetch gauge data: ${response.status}`);
        const json = await response.json();

        return {
            current: Number(json["current"]),
            water: Number(json["water"])
        };
    };

    private powerUsage: CurrentFields = { current: [] };
    private gasUsage: GasFields = { gas: [] };

    private updatePowerUsageGraph = async (minutes = 1) => {
        const newValues = await this.retrievePowerUsage(minutes);
        (newValues.current as unknown[]).reverse();

        this.powerUsage.current = mergeNewWithOldValues(newValues.current, this.powerUsage.current);

        this.drawPowerUsage(this.powerUsage);
    };

    private updateGasUsageGraph = async () => {
        this.gasUsage.gas = await this.retrieveGasUsage();
        this.drawGasUsage(this.gasUsage);
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

        this.recentCurrentGraph.setData(
            this.lastHourDescription,
            new CurrentPowerUsageGraphDescription(this.lastHourDescription),
            [{
                name: "current", values: fieldsKW.current, lineColor: black, fill: {
                    positive: stroomUsageColorForCurrentGraph,
                    negative: stroomGenerationColorForCurrentGraph
                }
            }])
            .animate(false);

        recentCurrentContainer.call(this.recentCurrentGraph.call);
    }

    private drawGasUsage(gas: GasFields) {
        const recentGasCard = d3.select("#recent_gas");
        const recentGasContainer = recentGasCard.select(".chart");
        setCardTitle(recentGasCard, "Gasverbruik");

        const sorted = [...gas.gas].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        if (sorted.length === 0) return;

        // Fill zeros for interior gaps between readings, but not after the last one
        const padded: ValueWithTimestamp[] = [];
        for (let i = 0; i < sorted.length; i++) {
            if (i > 0) {
                let t = addMinutes(sorted[i - 1].timestamp, 10);
                while (t < sorted[i].timestamp) {
                    padded.push({ timestamp: t, value: 0 });
                    t = addMinutes(t, 10);
                }
            }
            padded.push(sorted[i]);
        }

        const lastElement = padded.at(-1)!;
        const endOfPeriod = addMinutes(lastElement.timestamp, 1);

        const periodDescription = new HourDescription({ endOfPeriod });
        const graphDescription = new CurrentGasUsageGraphDescription(periodDescription);
        this.recentGasGraph.data(periodDescription, graphDescription, padded);
        recentGasContainer.call(this.recentGasGraph.call);
    }

    private updateGauge(value: { current: number; water: number }) {
        const currentGaugeCard = d3.select("#current_power_gauge");
        const currentGaugeContainer = currentGaugeCard.select(".chart");
        setCardTitle(currentGaugeCard, "Huidig stroomgebruik");

        this.powerUsageGauge.value(value.current);

        currentGaugeContainer.call(this.powerUsageGauge.call);
    }
}
