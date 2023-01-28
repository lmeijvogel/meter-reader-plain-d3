import * as d3 from "d3";
import { grey } from "../colors";

type Store = {
    currentValue: number;

    colorRanges: { start: number; color: string }[];
    domain: [min: number, max: number];
};

const startAngleFromTop = (2 * Math.PI) / 3;

const width = 480;
const height = 240;

const defaultTransform = `translate(${width / 2}, ${height / 2 + 20})`;

const outerSize = 110;

const gaugeOuterRadius = outerSize * 0.92;
const gaugeInnerRadius = outerSize * 0.5;

export function gauge() {
    let firstDrawCall = true;
    const store: Store = {
        colorRanges: [],
        currentValue: 0,
        domain: [0, 3000]
    };

    const scaleArcBorder = d3.arc();

    const scale: d3.ScaleLinear<number, number, never> = d3.scaleLinear();

    const initializeGraph = () => {
        scale.range([-startAngleFromTop, startAngleFromTop]).clamp(true);

        scaleArcBorder.innerRadius(gaugeInnerRadius).outerRadius(outerSize);
    };

    const renderScale = (svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
        const sortedRanges = [...store.colorRanges].sort((r1, r2) =>
            r1.start < r2.start ? -1 : r1.start > r2.start ? 1 : 0
        );

        svg.select("g.scales").selectAll("*").remove();
        for (let i = 0; i < sortedRanges.length; i++) {
            const currentElement = store.colorRanges[i];
            const nextStart = i < store.colorRanges.length - 1 ? store.colorRanges[i + 1].start : store.domain[1];

            const scaleArc = d3
                .arc()
                .startAngle(scale(currentElement.start))
                .endAngle(scale(nextStart))
                .innerRadius(gaugeInnerRadius)
                .outerRadius(outerSize);

            const path = svg.select("g.scales").append("path");

            path.style("fill", currentElement.color).attr("d", scaleArc as any);
        }

        scaleArcBorder.startAngle(scale(store.domain[0]));
        scaleArcBorder.endAngle(scale(store.domain[1]));

        svg.select("path.scaleBorder")
            .style("fill", "none")
            .style("stroke", "black")
            .style("stroke-width", "1px")
            .attr("d", scaleArcBorder as any);
    };

    const renderTicks = (svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
        const ticksContainer = svg.select(".ticks");

        d3.union(
            store.domain,
            store.colorRanges.map((r) => r.start)
        ).forEach((value) => {
            const rotationRad = scale(value);
            ticksContainer
                .append("line")
                .style("stroke", "black")
                .attr("x1", 0)
                .attr("x2", 0)
                .attr("y1", -outerSize - 10)
                .attr("y2", -outerSize)
                .attr("transform", `rotate(${radToDeg(rotationRad)})`);

            const textX = Math.sin(rotationRad) * (outerSize + 15);
            const textY = -Math.cos(rotationRad) * (outerSize + 15);

            ticksContainer
                .append("text")
                .attr("text-anchor", value < 0 ? "end" : value > 0 ? "start" : "middle")
                .attr("dominant-baseline", value === 0 ? "baseline" : "middle")
                .text(value)
                .attr("x", textX)
                .attr("y", textY)
                .style("stroke", "none");
        });
    };

    function getCurrentAngle(el: d3.BaseType) {
        const transform = d3.select(el).attr("transform");

        const match = transform.match(/rotate\((-?\d+(?:\.\d+)?)/);

        if (!match) {
            return radToDeg(scale(0));
        }

        const angle = parseFloat(match[1]);

        return angle;
    }

    function renderGraph(svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        const points = [
            [-1, -gaugeOuterRadius + 5],
            [1, -gaugeOuterRadius + 5],
            [4, 10],
            [-4, 10]
        ];

        const line = d3.line().curve(d3.curveLinearClosed);

        const rad = scale(store.currentValue);
        const degrees = radToDeg(rad);

        svg.select("path.needle")
            .attr("d", line(d3.polygonHull(points as any) as any))
            .attr("fill", "black")
            .transition()
            .ease(d3.easeBackOut.overshoot(0.9))
            .duration(500)
            .tween("transform", function () {
                /* Without this tween, the needle will rotate through the bottom when that is
                 * the shortest path.
                 */
                let currentAngle = getCurrentAngle(this);

                let i = d3.interpolate(currentAngle, degrees);

                return (t: number) => {
                    d3.select(this).attr("transform", `${defaultTransform}rotate(${i(t)})`);
                };
            });

        svg.select("circle.needlePin").attr("cx", 0).attr("cy", 0).attr("r", "2px").attr("fill", grey);

        svg.select("g.number")
            .selectAll("text")
            .data([store.currentValue])
            .join("text")
            .style("fill", "black")
            .style("font-size", "20pt")
            .attr("text-anchor", "middle")
            .text(d3.format("d"));

        svg.select("text.unit")
            .style("fill", "black")
            .style("font-size", "12pt")
            .attr("text-anchor", "middle")
            .text("W");
    }

    initializeGraph();

    const api = {
        value(value: number) {
            store.currentValue = value;

            return api;
        },
        domain(domain: [min: number, max: number]) {
            store.domain = domain;
            scale.domain(domain);

            return api;
        },

        colors(
            colorRanges: {
                start: number;
                color: string;
            }[]
        ) {
            store.colorRanges = colorRanges;

            return api;
        },

        call: (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
            selection.attr("viewBox", `0 0 ${width} ${height}`);

            if (firstDrawCall) {
                firstDrawCall = false;

                addSvgChildTags(selection);
                renderScale(selection);
                renderTicks(selection);
            }
            renderGraph(selection);

            return api;
        }
    };

    return api;
}

function radToDeg(rad: number) {
    return (rad / (2 * Math.PI)) * 360;
}

function addSvgChildTags(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
    selection.append("path").attr("class", "scaleBorder").attr("transform", defaultTransform);
    selection.append("g").attr("class", "scales").attr("transform", defaultTransform);
    selection.append("g").attr("class", "ticks").attr("transform", defaultTransform);

    selection.append("path").attr("class", "needle").attr("transform", defaultTransform);
    selection.append("circle").attr("class", "needlePin").attr("transform", defaultTransform);
    selection
        .append("g")
        .attr("class", "number")
        .attr("transform", `translate(${width / 2} ${height * 0.75})`);

    selection
        .append("text")
        .attr("class", "unit")
        .attr("transform", `translate(${width / 2} ${height * 0.75 + 20})`);
}
