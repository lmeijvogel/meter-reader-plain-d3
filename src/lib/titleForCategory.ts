import { PriceCategory } from "./PriceCalculator";
import { assertNever } from "./assertNever";

export function titleForCategory(priceCategory: PriceCategory | "generation"): string {
    let categoryName: string;

    switch (priceCategory) {
        case "gas":
            categoryName = "Gas";
            break;
        case "stroom":
            categoryName = "Stroom";
            break;
        case "water":
            categoryName = "Water";
            break;
        case "generation":
            categoryName = "Opwekking";
            break;
        default:
            assertNever(priceCategory);
    }
    return categoryName;
}
