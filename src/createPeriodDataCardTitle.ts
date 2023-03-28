import * as d3 from "d3";
import { PriceCalculator, PriceCategory } from "./lib/PriceCalculator";
import { titleForCategory } from "./lib/titleForCategory";
import { GraphDescription } from "./models/GraphDescription";
import { ValueWithTimestamp } from "./models/ValueWithTimestamp";

export function createPeriodDataCardTitle(
    values: ValueWithTimestamp[],
    priceCategory: PriceCategory | "generation",
    graphDescription: GraphDescription,
    priceCalculator: PriceCalculator
): string {
    const usage = d3.sum(values, (v) => v.value);

    const categoryName = titleForCategory(priceCategory);

    const formattedAmount = d3.format(graphDescription.tooltipValueFormat)(usage);

    const result = `${categoryName}: ${formattedAmount} ${graphDescription.displayableTotalsUnit}`;

    /* Use "stroom" for generation price as long as we have "saldering" */
    const costs = priceCalculator.costsForMultiple(
        values,
        priceCategory === "generation" ? "stroom" : priceCategory
    );

    return result + ` (${costs})`;
}


