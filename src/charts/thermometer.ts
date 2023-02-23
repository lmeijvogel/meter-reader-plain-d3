import * as d3 from "d3";
import { scaleLinear } from "d3";

const MIN_TEMP = -10;
const MAX_TEMP = 40;

const centerX = 7;
const gaugeWidth = 4;
const reservoirRadius = gaugeWidth;
const hgWidth = gaugeWidth - 2;
const reservoirTop = gaugeWidth * 0.9;

type RelevantValues = {
    minimum: number;
    maximum: number;
    current?: number;
};

const colors = {
    minimum: "blue",
    maximum: "red",
    current: "black"
};

export class Thermometer {
    constructor(private readonly selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {}

    scale = d3.scaleLinear().domain([MIN_TEMP, MAX_TEMP]).range([130, 10]);

    draw(values: RelevantValues) {
        this.selection.selectAll("*").remove();
        this.selection.attr("viewBox", "0 0 10 150");

        const axisContainer = this.selection.append("g").attr("class", "thermometerAxis");
        axisContainer.attr("transform", `translate(${centerX - gaugeWidth / 2}, 0)`);

        const tickTransparencyScale = this.buildTickTransparencyScale(values);

        this.drawAxis(tickTransparencyScale, axisContainer);
        this.drawMinimumMarker(this.scale, values.minimum);

        const line = this.selection.append("line");
        line.attr("x1", centerX - gaugeWidth / 2)
            .attr("x2", centerX - gaugeWidth / 2)
            .attr("y1", this.scale(MAX_TEMP))
            .attr("y2", this.scale(MIN_TEMP))
            .style("stroke", "black");

        const line2 = this.selection.append("line");
        line2
            .attr("x1", centerX + gaugeWidth / 2)
            .attr("x2", centerX + gaugeWidth / 2)
            .attr("y1", this.scale(MAX_TEMP))
            .attr("y2", this.scale(MIN_TEMP))
            .style("stroke", "black");

        const top = this.selection.append("circle");
        top.attr("cx", centerX)
            .attr("cy", this.scale(MAX_TEMP))
            .attr("r", gaugeWidth / 2)
            .style("fill", "white")
            .style("stroke", "black");

        const reservoirEdge = this.selection.append("circle");
        reservoirEdge
            .attr("cx", centerX)
            .attr("cy", this.scale(MIN_TEMP) + reservoirTop)
            .attr("r", reservoirRadius)
            .style("fill", "white")
            .style("stroke", "black");

        const background = this.selection.append("rect");
        background
            .attr("x", centerX - gaugeWidth / 2)
            .attr("width", gaugeWidth)
            .attr("y", this.scale(MAX_TEMP))
            .attr("height", this.scale(MIN_TEMP) - this.scale(MAX_TEMP))
            .style("fill", "white");

        const reservoir = this.selection.append("circle");
        reservoir
            .attr("cx", centerX)
            .attr("cy", this.scale(MIN_TEMP) + reservoirTop)
            .attr("r", reservoirRadius - 2)
            .style("fill", "#f00")
            .style("stroke", "none");

        const column = this.selection.append("rect");
        column
            .attr("x", centerX - hgWidth / 2)
            .attr("width", hgWidth)
            .attr("y", this.scale(values.maximum))
            .attr("height", this.scale(MIN_TEMP) - this.scale(values.maximum) + reservoirRadius)
            .style("fill", "#f00");
    }

    private drawMinimumMarker(scale: d3.ScaleLinear<number, number, never>, value: number) {
        if (!value) return;

        const valuesContainer = this.selection.append("g").attr("class", "thermometerValues");

        const x = centerX + gaugeWidth / 2;
        const y = scale(value);

        valuesContainer
            .append("line")
            .attr("x1", x)
            .attr("x2", x + 5)
            .attr("y1", y)
            .attr("y2", y)
            .style("stroke", colors.minimum)
            .style("strokeWidth", 1);
    }

    /* Because I want axis ticks to fade out, a regular d3.axis isn't sufficient:
     * Every tick is always drawn inside a <text> element, so rendered verbatim (markdown
     * and all).
     */
    private drawAxis(
        tickTransparencyScale: d3.ScaleLinear<number, number, never>,
        axisContainer: d3.Selection<SVGGElement, unknown, HTMLElement, any>
    ) {
        const axisValues = d3.range(MIN_TEMP, MAX_TEMP, 5);

        axisContainer
            .selectAll("text.thermometerTick")
            .data(axisValues)
            .join("text")
            .attr("class", "thermometerTick")
            .text((d) => d.toString())
            .style("width", 30)
            .attr("dominant-baseline", "middle")
            .attr("transform", (d) => `translate(-10, ${this.scale(d)})`)
            .attr("text-anchor", "end")
            .style("fill", (d) => this.colorForTick(d, tickTransparencyScale).formatRgb());

        axisContainer
            .selectAll("text.thermometerTickLine")
            .data(axisValues)
            .join("line")
            .attr("class", "thermometerTickLine")
            .attr("x1", -5)
            .attr("x2", 0)
            .attr("y1", (d) => this.scale(d))
            .attr("y2", (d) => this.scale(d))
            .attr("stroke", (d) => this.colorForTick(d, tickTransparencyScale).formatRgb());
    }

    private buildTickTransparencyScale(values: RelevantValues) {
        /**
         * The radius around current temperatures that are guaranteed to stay black.
         * This is here because we'd like the tick directly outside of a value to
         * be visible enough.
         */
        const ensureBlackRange = 2;
        const fadeOutInterval = 10;

        return scaleLinear()
            .domain([
                values.maximum + ensureBlackRange + fadeOutInterval,
                values.maximum + ensureBlackRange,
                values.minimum - ensureBlackRange,
                values.minimum - ensureBlackRange - fadeOutInterval
            ])
            .range([0, 1, 1, 0]);
    }

    private colorForTick(tick: number, tickTransparencyScale: d3.ScaleLinear<number, number, never>): d3.Color {
        return d3.rgb(0, 0, 0, tickTransparencyScale(tick));
    }
}
