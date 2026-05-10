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
import { CurrentPowerUsageGraphDescription } from "./models/GraphDescription";
import { ValueWithTimestamp } from "./models/ValueWithTimestamp";
import { setCardTitle } from "./vizCard";
import { LastHourDescription } from "./models/periodDescriptions/LastHourDescription";
import { gasUsageBurstsChart } from "./charts/gasUsageBurstsChart";

type CurrentFields = { current: ValueWithTimestamp[] };
type GasFields = { gas: ValueWithTimestamp[] };

const MAX_BURST_GAP_MINUTES = 120;
const MAX_BURSTS = 5;

function buildGasBursts(measurements: ValueWithTimestamp[]): ValueWithTimestamp[][] {
    const sorted = [...measurements].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    if (sorted.length === 0) return [];

    const bursts: ValueWithTimestamp[][] = [];
    let current: ValueWithTimestamp[] = [];

    for (let i = 0; i < sorted.length; i++) {
        if (i > 0) {
            const gapMinutes =
                (sorted[i].timestamp.getTime() - sorted[i - 1].timestamp.getTime()) / 60000;

            if (gapMinutes > MAX_BURST_GAP_MINUTES) {
                bursts.push(current);
                current = [];
            } else {
                let t = addMinutes(sorted[i - 1].timestamp, 10);
                while (t < sorted[i].timestamp) {
                    current.push({ timestamp: t, value: 0 });
                    t = addMinutes(t, 10);
                }
            }
        }
        current.push(sorted[i]);
    }
    bursts.push(current);

    return bursts.filter((b) => b.some((p) => p.value > 0)).slice(-MAX_BURSTS);
}

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
            { start: 2000, color: gaugeWorseColor },
        ]);

    private lastHourDescription = new LastHourDescription();
    private readonly recentCurrentGraph = lineChart().minMaxCalculation("quantile");
    private readonly recentGasGraph = gasUsageBurstsChart().color(gasGraphColor);

    private pageInvisibleTimestamp: Date | undefined;

    private gaugesTimer: NodeJS.Timer | undefined;
    private recentPowerGraphTimer: NodeJS.Timer | undefined;
    private recentGasGraphTimer: NodeJS.Timer | undefined;

    constructor(
        private readonly onDataReceived: (values: { current: number; water: number }) => void,
        private readonly updateLocation: (newPath: string) => void
    ) {}

    initializePage(selector: string) {
        createRowsWithCards([["recent_current", { id: "current_power_gauge", svg: true }], ["recent_gas"]], selector);

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
                value: Number(row.power),
            })),
        };
    };

    private retrieveGasUsage = async (): Promise<ValueWithTimestamp[]> => {
        const response = await fetch("/api/gas/recent?minutes=10080");
        if (!response.ok) throw new Error(`Failed to fetch gas usage: ${response.status}`);
        const json = await response.json();

        return json.map((row: any) => ({
            timestamp: new Date(Date.parse(row.timestamp)),
            value: Number(row.gas_usage),
        }));
    };

    private fetchGaugeData = async () => {
        const response = await fetch("/api/usage/last");
        if (!response.ok) throw new Error(`Failed to fetch gauge data: ${response.status}`);
        const json = await response.json();

        return {
            current: Number(json["current"]),
            water: Number(json["water"]),
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
            water: newValues.water,
        };

        this.updateGauge(displayableValues);
        this.onDataReceived(displayableValues);
    };

    private drawPowerUsage(fieldsKW: CurrentFields) {
        const recentCurrentCard = d3.select("#recent_current");
        const recentCurrentContainer = recentCurrentCard.select(".chart");
        setCardTitle(recentCurrentCard, "Stroomverbruik laatste uur");

        this.recentCurrentGraph
            .setData(this.lastHourDescription, new CurrentPowerUsageGraphDescription(this.lastHourDescription), [
                {
                    name: "current",
                    values: fieldsKW.current,
                    lineColor: black,
                    fill: {
                        positive: stroomUsageColorForCurrentGraph,
                        negative: stroomGenerationColorForCurrentGraph,
                    },
                },
            ])
            .animate(false);

        recentCurrentContainer.call(this.recentCurrentGraph.call);
    }

    private drawGasUsage(gas: GasFields) {
        const recentGasCard = d3.select("#recent_gas");
        const recentGasContainer = recentGasCard.select(".chart");
        setCardTitle(recentGasCard, "Gasverbruik");

        const bursts = buildGasBursts(gas.gas);
        if (bursts.length === 0) return;

        this.recentGasGraph.data(bursts);
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
