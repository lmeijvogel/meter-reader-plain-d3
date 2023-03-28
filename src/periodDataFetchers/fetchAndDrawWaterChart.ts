import * as d3 from "d3";
import { BarChartApi } from "../charts/barChart";
import { createPeriodDataCardTitle } from "../createPeriodDataCardTitle";
import { PriceCalculator } from "../lib/PriceCalculator";
import { WaterGraphDescription } from "../models/GraphDescription";
import { PeriodDescription } from "../models/periodDescriptions/PeriodDescription";
import { setCardTitle } from "../vizCard";
import { fetchChartData } from "./fetchChartData";

export function fetchAndDrawWaterChart(periodDescription: PeriodDescription, waterChartApi: BarChartApi, shouldClearCanvas: boolean, priceCalculator: PriceCalculator) {
    const periodWaterContainer = d3.select("#water_period_data");

    fetchChartData("water", periodDescription, periodWaterContainer).then((values) => {
        if (!values.requestedPeriodDescription.equals(periodDescription)) {
            return;
        }

        const graphDescription = new WaterGraphDescription(periodDescription);

        const cardTitle = createPeriodDataCardTitle(values.result, "water", graphDescription, priceCalculator);
        setCardTitle(periodWaterContainer, cardTitle);

        waterChartApi
            .clearCanvas(shouldClearCanvas)
            .data(periodDescription, graphDescription, values.result)
            .call(periodWaterContainer.select(".chart"));
    });
}
