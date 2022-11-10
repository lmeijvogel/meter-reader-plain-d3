import * as d3 from "d3";

export type ClosestIndex = {
    index: number;
    timestamp: Date;
};

/* The `pointerX` argument is given when something different than the pointer is
 * necessary, e.g. for brushes where the pointer is at best only half the information.
 */
export function getClosestIndex(
    event: any,
    scaleX: d3.ScaleTime<number, number, never>,
    series: { timestamp: Date }[],
    pointerX: number = d3.pointer(event)[0]
): ClosestIndex {
    var bisect = d3.bisector((d: { timestamp: Date }) => d.timestamp).right;

    const pointerDate = scaleX.invert(pointerX);

    const index = bisect(series, pointerDate, 1) - 1;
    return { index, timestamp: series[index].timestamp };
}
