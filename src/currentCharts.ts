import * as d3 from "d3";
import { subHours } from "date-fns";
import { gauge } from "./charts/gauge";
import { lineChart } from "./charts/lineChart";
import { responseRowToMeasurementEntry } from "./helpers/responseRowToMeasurementEntry";
import { MeasurementEntry } from "./models/MeasurementEntry";
import { LastHourDescription } from "./models/PeriodDescription";

const gaugeContainer = d3.select("#current_power_gauge");
const recentCurrentContainer = d3.select("#recent_current");
const powerUsageGauge = gauge().domain([-3000, 3000]).goodValue(0).okValue(500).warnValue(2000).maxValue(3000);

const recentCurrentGraph = lineChart(new LastHourDescription())
    .minMaxCalculation("quantile")
    .tooltipDateFormat("HH:mm")
    .tooltipValueFormat("d")
    .tooltipDisplayableUnit("W");

type CurrentFields = { current: MeasurementEntry[]; generation: MeasurementEntry[] };

async function retrievePowerUsage(page = 0) {
    return fetch(`/api/stroom/recent?page=${page}`)
        .then((response) => response.json())
        .then((json) => {
            const fieldsKW: CurrentFields = {
                current: json["current"].map(responseRowToMeasurementEntry),
                generation: json["generation"].map(responseRowToMeasurementEntry)
            };

            return fieldsKW;
        });
}

const powerUsage: CurrentFields = {
    current: [],
    generation: []
};

async function updatePowerUsage(page = 0) {
    const newValues = await retrievePowerUsage(page);

    powerUsage.current = addAndReplaceValues(powerUsage.current, newValues.current);
    powerUsage.generation = addAndReplaceValues(powerUsage.generation, newValues.generation);

    drawPowerUsage(powerUsage);
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
    const currentInW = fieldsKW.current.map((entry) => ({ ...entry, value: entry.value * 1000 }));
    const generationInW = fieldsKW.generation.map((entry) => ({ ...entry, value: entry.value * -1000 }));

    const lastCurrent = currentInW[currentInW.length - 1]?.value ?? 0;
    const lastGeneration = generationInW[generationInW.length - 1]?.value ?? 0;

    const newValue = lastCurrent + lastGeneration;

    powerUsageGauge.value(newValue);

    gaugeContainer.call(powerUsageGauge.call);

    recentCurrentGraph.setSeries("current", currentInW, "#f0ad4e");
    recentCurrentGraph.setSeries("generation", generationInW, "#adf04e");

    recentCurrentContainer.call(recentCurrentGraph.call);
}

export async function initializeCurrentCharts() {
    await retrieveAndDrawPowerUsageInBatches();

    // Done with the batches: Only set interval now, now that we're in a known state.
    setInterval(updatePowerUsage, 5000);
}

async function retrieveAndDrawPowerUsageInBatches() {
    for (let i = 0; i < 6; i++) {
        const batch = await retrievePowerUsage(i);

        powerUsage.current = sortByTimestamp([...batch.current, ...powerUsage.current]);
        powerUsage.generation = sortByTimestamp([...batch.generation, ...powerUsage.generation]);

        drawPowerUsage(powerUsage);
    }
}

function sortByTimestamp(entries: MeasurementEntry[]): MeasurementEntry[] {
    return d3.sort(entries, (a, b) => (a.timestamp < b.timestamp ? -1 : 1));
}
