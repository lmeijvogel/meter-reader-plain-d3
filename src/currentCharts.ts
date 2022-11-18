import * as d3 from "d3";
import { differenceInMinutes, differenceInSeconds, subHours } from "date-fns";
import { gauge } from "./charts/gauge";
import { lineChart } from "./charts/lineChart";
import { responseRowToMeasurementEntry } from "./helpers/responseRowToMeasurementEntry";
import { CurrentPowerUsageGraphDescription } from "./models/GraphDescription";
import { MeasurementEntry } from "./models/MeasurementEntry";
import { LastHourDescription } from "./models/PeriodDescription";
import { setCardTitle } from "./vizCard";

/* A single retrieve does 10 minutes, so be on the safe side */
const RELOAD_GRAPH_THRESHOLD_IN_MINUTES = 9;

const powerUsageGauge = gauge().domain([-3000, 3000]).goodValue(0).okValue(500).warnValue(2000).maxValue(3000);

const lastHourDescription = new LastHourDescription();
const recentCurrentGraph = lineChart(
    lastHourDescription,
    new CurrentPowerUsageGraphDescription(lastHourDescription)
).minMaxCalculation("quantile");

type CurrentFields = { current: MeasurementEntry[] };

let pageInvisibleTimestamp: Date | undefined;

let powerGaugeTimer: NodeJS.Timer | undefined;
let recentPowerGraphTimer: number | undefined;

window.addEventListener("visibilitychange", () => {
    const pageVisible = document.visibilityState === "visible";

    if (pageVisible) {
        initializeCurrentCharts();
    } else {
        clearInterval(powerGaugeTimer);
        clearInterval(recentPowerGraphTimer);
        powerGaugeTimer = undefined;
        recentPowerGraphTimer = undefined;

        pageInvisibleTimestamp = new Date();
    }
});

async function retrievePowerUsage(minutes = 10) {
    return fetch(`/api/stroom/recent?minutes=${minutes}`)
        .then((response) => response.json())
        .then((json) => {
            const fieldsKW: CurrentFields = {
                current: json["current"].map(responseRowToMeasurementEntry)
            };

            return fieldsKW;
        });
}

async function retrieveLatestPowerUsage() {
    return fetch("/api/stroom/last")
        .then((response) => response.json())
        .then((json) => {
            const fieldsKW: CurrentFields = {
                current: json["current"].map(responseRowToMeasurementEntry)
            };

            return fieldsKW;
        });
}

const powerUsage: CurrentFields = {
    current: []
};

async function updatePowerUsageGraph(minutes: number = 1) {
    const newValues = await retrievePowerUsage(minutes);

    powerUsage.current = addAndReplaceValues(powerUsage.current, newValues.current);

    drawPowerUsage(powerUsage);
}

async function getLatestPowerUsage() {
    const newValues = await retrieveLatestPowerUsage();

    const currentValueInW = newValues.current[0].value * 1000;

    updateCurrentUsageGauge(currentValueInW);
}

function addAndReplaceValues(existing: MeasurementEntry[], newValues: MeasurementEntry[]): MeasurementEntry[] {
    if (existing.length === 0) {
        return newValues;
    }

    const tooOld = subHours(new Date(), 1);

    /* For this whole function, I'm assuming both lists are sorted */
    const maxValue = existing.at(-1)!.timestamp;

    const bisect = d3.bisector((d: { timestamp: Date }) => d.timestamp).right;

    const indexOfOlderItems = bisect(existing, tooOld);
    const indexOfNewerItems = bisect(newValues, maxValue!);

    /* Apparently, the last value of each batch is "special",
     * it is not aligned on 6 seconds, as are the other ones.
     *
     * These values tend to accumulate (albeit slowly) if I
     * don't filter them out (the -1 in the first slice).
     *
     * I only filter them out of the previous batch, because
     * including the value at the end _is_ more accurate.
     */
    return [...existing.slice(indexOfOlderItems, -1), ...newValues.slice(indexOfNewerItems)];
}

function drawPowerUsage(fieldsKW: CurrentFields) {
    const recentCurrentCard = d3.select("#recent_current");
    const recentCurrentContainer = recentCurrentCard.select(".chart");
    setCardTitle(recentCurrentCard, "Stroomverbruik laatste uur");

    const currentInW = fieldsKW.current.map((entry) => ({ ...entry, value: entry.value * 1000 }));

    recentCurrentGraph.setSeries("current", currentInW, "black", { positive: "#f0ad4e", negative: "#adf04e" });

    recentCurrentContainer.call(recentCurrentGraph.call);
}

function updateCurrentUsageGauge(valueInW: number) {
    const gaugeCard = d3.select("#current_power_gauge");
    const gaugeContainer = gaugeCard.select(".chart");
    setCardTitle(gaugeCard, "Huidig stroomverbruik");

    powerUsageGauge.value(valueInW);

    gaugeContainer.call(powerUsageGauge.call);
}

export async function initializeCurrentCharts() {
    const pageVisible = document.visibilityState === "visible";

    /* This duplicates the check at the top, but we don't want the intervals
     * to be set if the page is loaded in the background.
     */
    if (!pageVisible) {
        return;
    }

    if (pageInvisibleTimestamp) {
        const minutesSinceLastLoad = differenceInMinutes(new Date(), pageInvisibleTimestamp);
        await retrievePowerUsage(minutesSinceLastLoad + 1);
    } else {
        /* This is the first page load, so load everything */
        await updatePowerUsageGraph(60);
    }

    pageInvisibleTimestamp = undefined;

    if (!powerGaugeTimer) {
        powerGaugeTimer = setInterval(getLatestPowerUsage, 1000);
    }

    if (!recentPowerGraphTimer) {
        recentPowerGraphTimer = setInterval(updatePowerUsageGraph, 5000);
    }
}
