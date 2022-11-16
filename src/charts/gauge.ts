import * as d3 from "d3";

const styles = require("./gauge.module.css");

type Store = {
    currentValue: number;

    domain: [min: number, max: number];
    goodValue: number;
    okValue: number;
    warnValue: number;
    maxValue: number;
};

const startAngleFromBottom = Math.PI / 3;

const width = 480;
const height = 240;

const defaultTransform = `translate(${width / 2}, ${height / 2})`;

const outerSize = 110;

const gaugeOuterRadius = outerSize * 0.92;
const gaugeInnerRadius = outerSize * 0.5;

export function gauge() {
    let firstDrawCall = true;
    const store: Store = {
        goodValue: 0,
        okValue: 0,
        warnValue: 0,
        maxValue: 0,
        currentValue: 0,
        domain: [0, 3000]
    };
    const scaleArcLightGreen = d3.arc();
    const scaleArcGreen = d3.arc();
    const scaleArcYellow = d3.arc();
    const scaleArcRed = d3.arc();
    const scaleArcBorder = d3.arc();

    const scale: d3.ScaleLinear<number, number, never> = d3.scaleLinear();

    const initializeGraph = () => {
        const bottom = Math.PI;

        scale.range([bottom + startAngleFromBottom, bottom + 2 * Math.PI - startAngleFromBottom]).clamp(true);

        scaleArcLightGreen.innerRadius(gaugeInnerRadius).outerRadius(outerSize);
        scaleArcGreen.innerRadius(gaugeInnerRadius).outerRadius(outerSize);
        scaleArcYellow.innerRadius(gaugeInnerRadius).outerRadius(outerSize);
        scaleArcRed.innerRadius(gaugeInnerRadius).outerRadius(outerSize);
        scaleArcBorder.innerRadius(gaugeInnerRadius).outerRadius(outerSize);
    };

    const renderScale = (svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
        scaleArcGreen.startAngle(scale(store.domain[0]));
        scaleArcLightGreen.startAngle(scale(0));

        const { goodValue, okValue, warnValue, maxValue } = store;

        if (goodValue !== undefined) {
            scaleArcGreen.endAngle(scale(goodValue));

            svg.select("path.scaleDarkGreen")
                .attr("class", styles.gaugeScaleGood)
                .attr("d", scaleArcGreen as any);
        }

        if (!!okValue) {
            scaleArcLightGreen.endAngle(scale(okValue));

            svg.select("path.scaleLightGreen")
                .attr("class", styles.gaugeScaleOk)
                .attr("d", scaleArcLightGreen as any);
        }

        scaleArcYellow.startAngle(scale(okValue ?? goodValue ?? 0));
        scaleArcYellow.endAngle(scale(warnValue ?? maxValue));

        svg.select("path.scaleYellow")
            .attr("class", styles.gaugeScaleRegular)
            .attr("d", scaleArcYellow as any);

        if (!!warnValue) {
            scaleArcRed.startAngle(scale(warnValue)).endAngle(scale(store.maxValue));
            svg.select("path.scaleRed")
                .attr("class", styles.gaugeScaleWarn)
                .attr("d", scaleArcRed as any);
        }

        scaleArcBorder.startAngle(scale(store.domain[0]));
        scaleArcBorder.endAngle(scale(store.domain[1]));

        svg.select("path.scaleBorder")
            .attr("class", styles.scaleBorder)
            .attr("d", scaleArcBorder as any);
    };

    function getGaugeClassName(): string {
        const { currentValue, goodValue, okValue, warnValue, maxValue } = store;

        if (currentValue > maxValue) {
            return styles.gaugeOverflow;
        }

        if (warnValue && currentValue > warnValue) {
            return styles.gaugeBad;
        }

        if (okValue && currentValue > okValue) {
            return styles.gaugeRegular;
        }

        if (!okValue) {
            return styles.gaugeRegular;
        }

        if (currentValue < goodValue) {
            return styles.gaugeGood;
        }

        return styles.gaugeOk;
    }

    function renderGraph(svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
        renderScale(svg);

        const points = [
            [-1, -gaugeOuterRadius + 5],
            [1, -gaugeOuterRadius + 5],
            [4, 10],
            [-4, 10]
        ];

        const line = d3.line().curve(d3.curveLinearClosed);

        const degrees = (scale(store.currentValue) / (2 * Math.PI)) * 360;

        svg.select("path.arrow")
            .attr("d", line(d3.polygonHull(points as any) as any))
            .attr("fill", "black")
            .transition()
            .duration(1000)
            .attr("transform", `${defaultTransform} rotate(${degrees} 0 0)`);

        svg.select("circle.arrowAnchor").attr("cx", 0).attr("cy", 0).attr("r", "2px").attr("fill", "#888");

        svg.select("g.number")
            .selectAll("text")
            .data([store.currentValue])
            .join("text")
            .attr("class", styles.gaugeText)
            .attr("text-anchor", "middle")
            .text(formatNumeric);
    }

    function formatNumeric(value: number) {
        const trimmedValue = d3.format("d")(value);

        return `${trimmedValue} W`;
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

        goodValue(value: number) {
            store.goodValue = value;

            return api;
        },
        okValue(value: number) {
            store.okValue = value;

            return api;
        },
        warnValue(value: number) {
            store.warnValue = value;

            return api;
        },
        maxValue(value: number) {
            store.maxValue = value;

            return api;
        },
        call: (selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
            selection.attr("viewBox", `0 0 ${width} ${height}`);

            if (firstDrawCall) {
                firstDrawCall = false;

                addSvgChildTags(selection);
            }
            renderGraph(selection);

            return api;
        }
    };

    return api;
}

function addSvgChildTags(selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
    selection.append("path").attr("class", "scaleDarkGreen").attr("transform", defaultTransform);
    selection.append("path").attr("class", "scaleLightGreen").attr("transform", defaultTransform);
    selection.append("path").attr("class", "scaleYellow").attr("transform", defaultTransform);
    selection.append("path").attr("class", "scaleRed").attr("transform", defaultTransform);
    selection.append("path").attr("class", "scaleBorder").attr("transform", defaultTransform);
    selection.append("path").attr("class", "arrow").attr("transform", defaultTransform);
    selection.append("circle").attr("class", "arrowAnchor").attr("transform", defaultTransform);
    selection
        .append("g")
        .attr("class", "number")
        .attr("transform", `translate(${width / 2} ${height * 0.75})`);
}
