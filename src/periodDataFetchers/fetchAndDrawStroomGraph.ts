import * as d3 from "d3";
import { UsageAndGenerationBarChartApi } from "../charts/usageAndGenerationBarChart";
import { PriceCalculator, PriceCategory } from "../lib/PriceCalculator";
import { GraphDescription, StroomGraphDescription } from "../models/GraphDescription";
import { PeriodDescription } from "../models/periodDescriptions/PeriodDescription";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";
import { setCardTitleRaw } from "../vizCard";
import { ChartDataResult, fetchChartData } from "./fetchChartData";

type EqualizedStroomData = {
    consumption: ValueWithTimestamp[];
    generation: {
        value: number;
        timestamp: Date;
    }[];
    backDelivery: {
        value: number;
        timestamp: Date;
    }[];
};

export function fetchAndDrawStroomGraph(periodDescription: PeriodDescription, api: UsageAndGenerationBarChartApi, shouldClearCanvas: boolean, priceCalculator: PriceCalculator) {
    const periodStroomContainer = d3.select("#stroom_period_data");

    Promise.all<ChartDataResult>([
        fetchChartData("stroom", periodDescription, periodStroomContainer),
        fetchChartData("generation", periodDescription, periodStroomContainer),
        fetchChartData("back_delivery", periodDescription, periodStroomContainer)
    ]).then(([stroomValues, generationValues, backDeliveryValues]) => {
        const allValid = [stroomValues, generationValues, backDeliveryValues].every(values => {
            return values.requestedPeriodDescription.equals(periodDescription);
        });

        if (!allValid) {
            return;
        }

        const equalizedData: EqualizedStroomData = {
            consumption: stroomValues.result,
            generation: generationValues.result.map((el) => ({
                ...el,
                value: el.value / 1000
            })),
            backDelivery: backDeliveryValues.result.map((el) => ({
                ...el,
                value: -el.value
            }))
        };

        api
            .clearCanvas(shouldClearCanvas)
            .data(periodDescription, equalizedData);

        const graphDescription = new StroomGraphDescription(periodDescription);

        const cardTitle = createStroomGraphCardTitle(equalizedData, "stroom", graphDescription, priceCalculator);
        setCardTitleRaw(periodStroomContainer, cardTitle, "stroomCardTitle");

        api.call(periodStroomContainer.select(".chart"));
    });
}

function createStroomGraphCardTitle(
    equalizedData: EqualizedStroomData,
    priceCategory: PriceCategory,
    graphDescription: GraphDescription,
    priceCalculator: PriceCalculator
) {
    const totalConsumption = formatPrice(
        equalizedData,
        "consumption",
        "Levering",
        priceCategory,
        graphDescription,
        priceCalculator
    );
    const totalBackDelivery = formatPrice(
        equalizedData,
        "backDelivery",
        "Teruglevering",
        priceCategory,
        graphDescription,
        priceCalculator
    );

    const consumptionPrice = priceCalculator.costsForMultiple(equalizedData.consumption, priceCategory);
    const backDeliveryCredit = priceCalculator.costsForMultiple(equalizedData.backDelivery, priceCategory);

    const netUsage =
        d3.sum(equalizedData.consumption, (v) => v.value) + d3.sum(equalizedData.backDelivery, (v) => v.value);

    const netCosts = consumptionPrice.add(backDeliveryCredit);

    return `<section class="stroomCardData">
                  ${totalConsumption}
                  ${totalBackDelivery}
                  <div class="netUsageCaption">Netto:</div><div class="number netUsageAmount">${d3.format(
        graphDescription.tooltipValueFormat
    )(netUsage)} ${graphDescription.displayableTotalsUnit
        }</div><div class="number netUsageCosts">(${netCosts})</div>
                </section>`;
}

function formatPrice(
    data: EqualizedStroomData,
    field: keyof EqualizedStroomData,
    caption: string,
    priceCategory: PriceCategory,
    graphDescription: GraphDescription,
    priceCalculator: PriceCalculator
): string {
    const total = d3.sum(data[field], (v) => v.value);

    const formattedAmount = d3.format(graphDescription.tooltipValueFormat)(total);

    const costs = priceCalculator.costsForMultiple(data[field], priceCategory);

    return `<div class="${field}Caption">${caption}:</div><div class="number ${field}Amount">${formattedAmount} ${graphDescription.displayableTotalsUnit}</div><div class="number ${field}Costs">(${costs})</div>`;
}

