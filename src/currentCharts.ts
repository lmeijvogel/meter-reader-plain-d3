import * as d3 from "d3";
import { subHours } from "date-fns";
import { gauge } from "./charts/gauge";
import { lineChart } from "./charts/lineChart";
import { responseRowToMeasurementEntry } from "./helpers/responseRowToMeasurementEntry";
import { CurrentPowerUsageGraphDescription } from "./models/GraphDescription";
import { MeasurementEntry } from "./models/MeasurementEntry";
import { LastHourDescription } from "./models/PeriodDescription";
import { setCardTitle } from "./vizCard";

const powerUsageGauge = gauge().domain([-3000, 3000]).goodValue(0).okValue(500).warnValue(2000).maxValue(3000);

const lastHourDescription = new LastHourDescription();
const recentCurrentGraph = lineChart(
    lastHourDescription,
    new CurrentPowerUsageGraphDescription(lastHourDescription)
).minMaxCalculation("quantile");

type CurrentFields = { current: MeasurementEntry[] };

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

async function updatePowerUsage(minutes: number) {
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
    const result: MeasurementEntry[] = [];

    const tooOld = subHours(new Date(), 1);

    const maxValue = d3.max(existing, (v) => v.timestamp);

    /* In practice, this might lead to more entries being added than
     * removed: The earlier retrievals can have fewer readings
     * (< 1 per second), while we can poll more frequently.
     *
     * I don't think this is a problem.
     */
    for (const existingValue of existing) {
        if (existingValue.timestamp > tooOld) {
            result.push(existingValue);
        }
    }

    for (const newValue of newValues) {
        if (newValue.timestamp > maxValue!) {
            result.push(newValue);
        }
    }

    result.sort();

    return result;
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
    await retrieveAndDrawPowerUsageInBatches();

    setInterval(getLatestPowerUsage, 1000);
    // Done with the batches: Only set interval now, now that we're in a known state.
    setInterval(updatePowerUsage, 5000);
}

async function retrieveAndDrawPowerUsageInBatches() {
    const batch = await retrievePowerUsage(60);

    powerUsage.current = batch.current;

    drawPowerUsage(powerUsage);
}
