import * as d3 from "d3";
import { PeriodDescription } from "../models/PeriodDescription";
import { Series } from "../models/Series";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

type SeriesCollection = Map<string, { series: Series; lineColor: string }>;

type Store = {
    allSeries: SeriesCollection;
    fillArea?: boolean;
    lineColors?: Map<string, string>;
    defaultLineColor: string;
    relativeMinMax: boolean;

    seriesCollection: SeriesCollection;
    domain?: [number, number];
};

const padding = {
    top: 10,
    right: 30,
    bottom: 10,
    left: 10
};

const width = 480;
const height = 240;

const axisWidth = 50;

export function lineChart(periodDescription: PeriodDescription) {
    const store: Store = {
        allSeries: new Map(),
        fillArea: false,
        lineColors: new Map(),
        defaultLineColor: "black",
        relativeMinMax: false,
        seriesCollection: new Map()
    };

    let firstDrawCall = true;

    const minimumX = padding.left + axisWidth;
    const maximumX = width - padding.right;
    const minimumY = padding.top;
    const maximumY = height - padding.bottom;

    const scaleX = d3.scaleTime().range([minimumX, maximumX]);
    const scaleY = d3.scaleLinear().range([minimumY, maximumY]).clamp(true);

    const yAxis = d3.axisLeft(scaleY);

    const api = {
        setSeries(name: string, series: Series, lineColor: string) {
            store.seriesCollection.set(name, { series, lineColor });

            return api;
        },

        domain(domain: [number, number]) {
            store.domain = domain;

            return api;
        },

        call: (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
            selection.attr("viewBox", `0 0 ${width} ${height}`);

            const domainX = [periodDescription.startOfPeriod(), periodDescription.endOfPeriod()];

            scaleX.domain(domainX);

            const domain = store.domain ?? getDomainY();

            const xAxisHeight = 20;
            scaleY.domain(domain).range([height - padding.bottom - xAxisHeight, padding.top]);

            selection.select("g.values").append("g").attr("class", "area");

            if (firstDrawCall) {
                firstDrawCall = false;

                addSvgChildTags(selection);
            }

            renderXAxis(selection.select(".xAxis"));
            selection
                .select(".yAxis")
                .attr("transform", `translate(${padding.left + axisWidth}, 0)`)
                .style("font-size", "13pt")
                .call(yAxis as any);

            store.seriesCollection.forEach((series, name) => {
                const seriesGClassName = `series_${name}`;

                let g = selection.select<SVGGElement>(`.${seriesGClassName}`);

                if (!g.node()) {
                    g = selection.append("g");
                    g.attr("class", seriesGClassName).attr("width", width).attr("height", height);
                }

                drawValues(series.series, series.lineColor, g);
            });

            return api;
        }
    };

    function drawValues(
        series: ValueWithTimestamp[],
        lineColor: string,
        selection: d3.Selection<SVGGElement, unknown, HTMLElement, any>
    ) {
        const lineGenerator = d3
            .line<ValueWithTimestamp>()
            .x((d) => {
                return scaleX(d.timestamp);
            })
            .y((d) => scaleY(d.value));

        selection
            .selectAll(`path.line`)
            .data([series])
            .join("path")
            .attr("class", `line`)
            .attr("fill", "none")
            .attr("stroke", lineColor)
            .attr("stroke-width", 2)
            .attr("d", lineGenerator);

        // if (store.fillArea) {
        // const series = Array.from(allSeries.values())[0];

        // const areaGenerator = d3
        // .area<ValueWithTimestamp>()
        // .x((d) => scaleX(d.timestamp))
        // .y0(scaleY(0))
        // .y1((d) => scaleY(d.value));

        // valuesSvg
        // .select("g.area")
        // .selectAll("path")
        // .data([series])
        // .join("path")
        // .attr("fill", graphDescription.lightColor)
        // .attr("stroke", graphDescription.barColor)
        // .attr("stroke-width", 0)
        // .attr("d", areaGenerator);
        // }

        //
        // // Create a rect on top of the svg area: this rectangle recovers mouse position
        // svg.on("mouseover", this.mouseover).on("mousemove", this.mousemove).on("mouseout", this.mouseout);

        // svg.select("g.tooltip").attr("width", 100).attr("height", 100).attr("fill", "white");
    }

    function addSvgChildTags(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        ["gridLines", "additionalInfo", "values", "xAxis", "yAxis"].forEach((className) => {
            const g = selection.append("g");

            g.attr("class", className);
        });
    }

    function renderXAxis(xAxisBase: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        const ticks = periodDescription.getChartTicks();
        const xAxis = d3.axisBottom(scaleX as any).ticks(ticks, d3.timeFormat(periodDescription.timeFormatString()));

        xAxisBase.attr("transform", `translate(0, ${scaleY(0)})`).call(xAxis as any);
    }

    function getDomainY(): number[] {
        const allValues = Array.from(store.seriesCollection.values()).flatMap((series) =>
            series.series.map((s) => s.value)
        );
        const min = Math.min(...allValues) * 0.95;
        const max = Math.max(...allValues) * 1.05;
        return [min, max];
    }

    return api;
}

// class LineChart extends ChartWithAxes<SpecificProps> {
// override initializeGraph() {

// // const crosshairsSvg = this.svg!.append("g");
// crosshairsSvg.attr("class", "crosshairs");

// crosshairsSvg.append("g").attr("class", "horizontal");
// crosshairsSvg.append("path").attr("class", "vertical");

// const tooltipSvg = this.svg!.append("g").attr("class", "tooltip");
// tooltipSvg.append("text").attr("fill", "black");
// }

// mouseover = () => {
// this.svg!.select("g.crosshairs").attr("opacity", 1);
// };

// // Example from https://d3-graph-gallery.com/graph/line_cursor.html
// mousemove = (event: any) => {
// if (!this.firstSeries) {
// return;
// }

// // This allows to find the closest X index of the mouse:
// var bisect = d3.bisector((d: MeasurementEntry) => d.timestamp).right;

// const pointerX = d3.pointer(event)[0];
// const pointerDate = this.scaleX.invert(pointerX);

// var firstSeriesClosestIndex = bisect(this.firstSeries, pointerDate, 1) - 1;

// // Find all y-values to highlight
// const ys = Array.from(this.props.allSeries.values()).map((series) => {
// var closestIndex = bisect(series, pointerDate, 1) - 1;
// return this.scaleY(series[closestIndex]?.value);
// });

// this.svg!.select("g.crosshairs g.horizontal")
// .selectAll("path.value")
// .data(ys)
// .join("path")
// .attr("class", "value")
// .attr("stroke", "black")
// .attr("stroke-width", 1)
// .attr("d", (y) => `M${this.padding.left + this.axisWidth},${y} H ${this.width - this.padding.right}`);

// const hoveredValue = this.firstSeries[firstSeriesClosestIndex];
// const x = this.scaleX(hoveredValue.timestamp);

// this.svg!.select("g.crosshairs path.vertical")
// .attr("stroke", "black")
// .attr("stroke-width", 1)
// .attr("d", `M${x},${this.padding.top} V ${this.height - this.padding.bottom}`);

// const tooltip = d3.select("#tooltip");

// const tooltipInput: { name: string; valueWithTimestamp: ValueWithTimestamp }[] = [];

// this.props.allSeries.forEach((series, key) => {
// var closestIndex = bisect(series, pointerDate, 1) - 1;

// tooltipInput.push({ name: key, valueWithTimestamp: series[closestIndex] });
// });

// tooltip
// .html(this.buildTooltipContents(tooltipInput))
// .style("left", event.pageX + 20 + "px")
// .style("top", event.pageY - 58 + "px")
// .style("display", "block");
// };

// mouseout = () => {
// this.svg!.select("g.crosshairs").attr("opacity", 0);

// d3.select("#tooltip").style("display", "none");
// };

// private buildTooltipContents(tooltipInput: { name: string; valueWithTimestamp: ValueWithTimestamp }[]) {
// const formattedValues = tooltipInput
// .filter((item) => isDefined(item.valueWithTimestamp))
// .map((item) => {
// const value = d3.format(this.props.graphDescription.tooltipValueFormat)(item.valueWithTimestamp.value);

// return `${item.name}: ${value} ${this.props.graphDescription.displayableUnit}`;
// });

// const displayedValue = formattedValues.join("<br>");

// const displayedTimestamp = this.props.periodDescription
// .atIndex(tooltipInput[0].valueWithTimestamp.timestamp)
// .toShortTitle();

// return `${displayedTimestamp}:<br>${displayedValue}`;
// }

// protected override getDomain(): number[] {
// const [min, max] = this.getMinValue(this.props.allSeries.values());

// const range = max - min;

// const padding = range * 0.1;

// return [Math.round(min - padding - 0.5), Math.round(max + padding + 0.5)];
// }

// private getMinValue(allSeries: Iterable<Series>): [min: number, max: number] {
// const allValues = Array.from(allSeries).flatMap((series) => series.flatMap((valueWithTs) => valueWithTs.value));

// const min = Math.min(...allValues);
// const max = Math.max(...allValues);

// return [min, max];
// }
// }
