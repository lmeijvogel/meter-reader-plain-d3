import * as d3 from "d3";
import { greatest, greatestIndex, leastIndex } from "d3";
import { differenceInSeconds, subHours } from "date-fns";

import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

export function mergeNewWithOldValues(
    newValues: ValueWithTimestamp[],
    existing: ValueWithTimestamp[],
    tooOld: Date = subHours(new Date(), 1)
): ValueWithTimestamp[] {
    if (existing.length === 0) {
        return newValues;
    }

    /* For this whole function, I'm assuming both lists are sorted */
    const maxValue = existing.at(-1)!.timestamp;

    const bisect = d3.bisector((d: { timestamp: Date }, x: Date) => {
        return differenceInSeconds(d.timestamp, x);
    }).right;

    const oldestValidExistingIndex = bisect(existing, tooOld);
    const firstNewItemIndex = bisect(newValues, maxValue);

    /* Apparently, the last value of each batch is "special",
     * it is not aligned on 6 seconds, as are the other ones.
     *
     * These values tend to accumulate (albeit slowly) if I
     * don't filter them out (the -1 in the first slice).
     *
     * I only filter them out of the previous batch, because
     * including the value at the end _is_ more accurate.
     */
    const retainedExistingItems = !!existing[oldestValidExistingIndex]
        ? existing.slice(oldestValidExistingIndex, -1)
        : existing;

    const retainedExistingItemsWithoutLastValue = retainedExistingItems.filter(
        (item) => item.timestamp.getMilliseconds() === 0
    );

    const addedNewItems = newValues.slice(firstNewItemIndex);

    return [...retainedExistingItemsWithoutLastValue, ...addedNewItems];
}
