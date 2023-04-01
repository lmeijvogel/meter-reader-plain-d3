import * as d3 from "d3";
import { utcToZonedTime } from "date-fns-tz";
import { BarChartApi } from "../charts/barChart";
import { lineChart } from "../charts/lineChart";
import { darkGenerationGraphColor, generationGraphColor, white, lightGrey, grey } from "../colors";
import { createPeriodDataCardTitle } from "../createPeriodDataCardTitle";
import { PriceCalculator } from "../lib/PriceCalculator";
import { GenerationGraphDescription } from "../models/GraphDescription";
import { DayDescription } from "../models/periodDescriptions/DayDescription";
import { PeriodDescription } from "../models/periodDescriptions/PeriodDescription";
import { setCardTitle } from "../vizCard";
import { fetchChartData } from "./fetchChartData";

export function fetchAndDrawGenerationChart(periodDescription: PeriodDescription, barChartApi: BarChartApi, priceCalculator: PriceCalculator, shouldClearCanvas: boolean) {
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
        if (!generationValues.requestedPeriodDescription.equals(periodDescription)) {
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
            generationBarChartApi = lineChart()
                .minMaxCalculation("minMax")
                .setData(periodDescription, graphDescription, [{
                    name: "opwekking", values: valuesInKWhPer15m, lineColor: darkGenerationGraphColor, strokeWidth: 1, fill: {
                        positive: generationGraphColor,
                        negative: white // The values will never be negative
                    }
                },
                { name: "gemiddelde", values: averagesValues, lineColor: lightGrey, strokeWidth: 1 }
                    , { name: "max", values: maxValues, lineColor: grey, strokeWidth: 1 }
                ])
                .renderOutsideLightShading(true);
        } else {
            generationBarChartApi = barChartApi;
            generationBarChartApi.data(periodDescription, graphDescription, valuesInKWhPer15m);
        }

        generationBarChartApi.clearCanvas(shouldClearCanvas);

        const cardTitle = createPeriodDataCardTitle(valuesInKW, "generation", graphDescription, priceCalculator);

        setCardTitle(periodGenerationContainer, cardTitle);

        generationBarChartApi.call(periodGenerationContainer.select(".chart"));
    });
}
