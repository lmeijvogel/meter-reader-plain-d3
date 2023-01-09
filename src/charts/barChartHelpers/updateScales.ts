import * as d3 from "d3";

import { PeriodDescription } from "../../models/PeriodDescription";
import { axisWidth, height, padding, width, xAxisHeight } from "./constants";
import { renderXAxis } from "./renderXAxis";

type Store<T> = {
    periodDescription: PeriodDescription;
    relativeMinMax: boolean;
    data: T[];
    minMaxCalculator: (data: T[]) => { min: number; max: number };
};

export function initScales(): {
    scaleX: d3.ScaleBand<Date>;
    scaleXForInversion: d3.ScaleTime<number, number, never>;
    scaleY: d3.ScaleLinear<number, number, never>;
} {
    const scaleY = d3
        .scaleLinear()
        .range([height - padding.bottom - xAxisHeight, padding.top])
        .clamp(true);

    const scaleX = d3
        .scaleBand<Date>()
        .padding(0.15)
        .range([padding.left + axisWidth, width - padding.right]);

    const scaleXForInversion = d3.scaleTime().range([axisWidth + padding.left, width - padding.right]);

    return { scaleX, scaleXForInversion, scaleY };
}

export function updateScales<T>(
    selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
    firstDrawCall: boolean,
    scaleX: d3.ScaleBand<Date>,
    scaleXForInversion: d3.ScaleTime<number, number, never>,
    scaleY: d3.ScaleLinear<number, number, never>,
    store: Store<T>
) {
    function getRelativeDomain(): number[] {
        const { min, max } = store.minMaxCalculator(store.data);

        return [min * 1.1, max * 1.1];
    }

    const { periodDescription } = store;

    const domainY = getRelativeDomain();

    scaleY.domain(domainY);

    const domainX = periodDescription
        .getExpectedDomainValues()
        .range(periodDescription.startOfPeriod(), periodDescription.endOfPeriod());

    scaleX.domain(domainX);

    scaleXForInversion.domain([periodDescription.startOfPeriod(), periodDescription.endOfPeriod()]);
    const xAxisBase = selection.select("g.xAxis").attr("class", "xAxis axis");

    xAxisBase
        .transition()
        .duration(firstDrawCall ? 0 : 200)
        .attr("transform", `translate(0, ${scaleY(0)})`);

    renderXAxis(xAxisBase, store);

    const yAxis = d3.axisLeft(scaleY);
    selection
        .select(".yAxis")
        .classed("axis", true)
        .attr("transform", `translate(${padding.left + axisWidth}, 0)`)
        .transition()
        .duration(200)
        .call(yAxis as any);

    return { scaleX, scaleXForInversion };
}
