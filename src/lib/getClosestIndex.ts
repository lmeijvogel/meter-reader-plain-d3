import * as d3 from "d3";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

/* The `pointerX` argument is given when something different than the pointer is
 * necessary, e.g. for brushes where the pointer is at best only half the information.
 */
export function getClosestIndex(
    event: any,
    scaleX: d3.ScaleTime<number, number, never>,
    series: ValueWithTimestamp[],
    pointerX: number = d3.pointer(event)[0]
): number {
    var bisect = d3.bisector((d: ValueWithTimestamp) => d.timestamp).right;

    const pointerDate = scaleX.invert(pointerX);

    return bisect(series, pointerDate, 1) - 1;
}
