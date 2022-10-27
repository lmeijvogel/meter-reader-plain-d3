import * as d3 from "d3";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

export function getClosestIndex(
    event: any,
    scaleX: d3.ScaleTime<number, number, never>,
    series: ValueWithTimestamp[]
): number {
    var bisect = d3.bisector((d: ValueWithTimestamp) => d.timestamp).right;

    const pointerX = d3.pointer(event)[0];
    const pointerDate = scaleX.invert(pointerX);

    return bisect(series, pointerDate, 1) - 1;
}
