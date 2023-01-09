import * as d3 from "d3";
import { PeriodDescription } from "../../models/PeriodDescription";
import { padding, axisWidth, width } from "./constants";

export function renderXAxis(
    xAxisBase: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
    store: {
        periodDescription: PeriodDescription;
    }
) {
    /* The reasonable assumption would be that creating a scale for a bar chart
     * would just reuse the band scale, but that has the downside that the ticks will
     * always end up in the middle of the bars. For the year and month charts that is fine:
     * A bar represents the usage for a given day or month.
     *
     * For the day chart, it feels better to have the bars *between* the axis ticks,
     * since the graph shows the usage between e.g. 09:00 and 10:00. And we need a linear
     * scale to do that: I can't persuade an xAxis based on a band scale to put the ticks
     * between the bands.
     */

    // Sadly, I also can't use the same logic as in the LineChart here, by using
    // scaleTime and using .ticks(), since bandScale does not support .ticks().

    const { periodDescription } = store;

    let domain = [periodDescription.startOfPeriod(), periodDescription.endOfPeriod()];

    if (periodDescription.graphTickPositions === "on_value") {
        domain = domain.map(periodDescription.shiftHalfTick);
    }

    const scaleXForXAxis = d3
        .scaleTime()
        .domain(domain)
        .range([padding.left + axisWidth, width - padding.right]);

    const ticks = periodDescription.getChartTicks();
    const xAxis = d3
        .axisBottom(scaleXForXAxis)
        .ticks(ticks, d3.timeFormat(periodDescription.tickFormatString()))
        .tickSizeOuter(0);

    xAxisBase
        .classed("axis", true)
        .call(xAxis as any)
        .selectAll("text")
        .style("text-anchor", null)
        // Got the 0.71em from the browser
        .attr("dy", "0.71em")
        .attr("transform", null);
}
