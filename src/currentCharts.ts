import * as d3 from "d3";
import { differenceInMinutes, subHours } from "date-fns";
import { gauge } from "./charts/gauge";
import { lineChart } from "./charts/lineChart";
import { mergeNewWithOldValues } from "./helpers/mergeNewWithOldValues";
import { responseRowToValueWithTimestamp } from "./helpers/responseRowToValueWithTimestamp";
import { CurrentPowerUsageGraphDescription } from "./models/GraphDescription";
import { LastHourDescription } from "./models/PeriodDescription";
import { ValueWithTimestamp } from "./models/ValueWithTimestamp";
import { setCardTitle } from "./vizCard";

const powerUsageGauge = gauge()
    .domain([-3000, 3000])
    .colors([
        { start: -3000, color: "#55ff11" },
        { start: 0, color: "#bbff33" },
        { start: 500, color: "#ffbb33" },
        { start: 2000, color: "#ff3333" }
    ]);

const lastHourDescription = new LastHourDescription();
const recentCurrentGraph = lineChart(
    lastHourDescription,
    new CurrentPowerUsageGraphDescription(lastHourDescription)
).minMaxCalculation("quantile");

type CurrentFields = { current: ValueWithTimestamp[] };

let pageInvisibleTimestamp: Date | undefined;

let powerGaugeTimer: NodeJS.Timer | undefined;
let recentPowerGraphTimer: NodeJS.Timer | undefined;

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
                current: json["current"].map(responseRowToValueWithTimestamp)
            };

            return fieldsKW;
        });
}

async function retrieveLatestPowerUsage() {
    return fetch("/api/stroom/last")
        .then((response) => response.json())
        .then((json) => {
            const fieldsKW: CurrentFields = {
                current: json["current"].map(responseRowToValueWithTimestamp)
            };

            return fieldsKW;
        });
}

const powerUsage: CurrentFields = {
    current: []
};

async function updatePowerUsageGraph(minutes: number = 1) {
    const newValues = await retrievePowerUsage(minutes);

    powerUsage.current = mergeNewWithOldValues(newValues.current, powerUsage.current);

    drawPowerUsage(powerUsage);
}

async function getLatestPowerUsage() {
    const newValues = await retrieveLatestPowerUsage();

    const currentValueInW = newValues.current[0].value * 1000;

    updateCurrentUsageGauge(currentValueInW);
}

function drawPowerUsage(fieldsKW: CurrentFields) {
    const recentCurrentCard = d3.select("#recent_current");
    const recentCurrentContainer = recentCurrentCard.select(".chart");
    setCardTitle(recentCurrentCard, "Stroomverbruik laatste uur");

    const currentInW = fieldsKW.current.map((entry) => ({ ...entry, value: entry.value * 1000 }));

    recentCurrentGraph
        .setSeries("current", currentInW, "black", { positive: "#f0ad4e", negative: "#adf04e" })
        .animate(false);

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
