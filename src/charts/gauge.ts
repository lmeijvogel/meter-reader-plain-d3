import classNames from "classnames";
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

const padding = 10;

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
    const valueArc = d3.arc();
    const guideArc = d3.arc();
    const scaleArcLightGreen = d3.arc();
    const scaleArcGreen = d3.arc();
    const scaleArcYellow = d3.arc();
    const scaleArcRed = d3.arc();

    const scale: d3.ScaleLinear<number, number, never> = d3.scaleLinear();

    const initializeGraph = () => {
        const bottom = Math.PI;

        scale.range([bottom + startAngleFromBottom, bottom + 2 * Math.PI - startAngleFromBottom]).clamp(true);

        const outerSize = 110;
        const scaleWidth = outerSize * 0.05;

        const gaugeOuterRadius = outerSize * 0.92;
        const gaugeWidth = outerSize * 0.3;

        valueArc.innerRadius(gaugeOuterRadius - gaugeWidth).outerRadius(gaugeOuterRadius);
        guideArc.innerRadius(gaugeOuterRadius - gaugeWidth).outerRadius(gaugeOuterRadius);
        scaleArcLightGreen.innerRadius(outerSize - scaleWidth).outerRadius(outerSize);
        scaleArcGreen.innerRadius(outerSize - scaleWidth).outerRadius(outerSize);
        scaleArcYellow.innerRadius(outerSize - scaleWidth).outerRadius(outerSize);
        scaleArcRed.innerRadius(outerSize - scaleWidth).outerRadius(outerSize);
    };

    const renderScale = (svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) => {
        guideArc.startAngle(scale(store.domain[0]));
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

        if (store.currentValue < 0) {
            valueArc.endAngle(scale(0));
            valueArc.startAngle(scale(store.currentValue));
        } else {
            valueArc.startAngle(scale(0));
            valueArc.endAngle(scale(store.currentValue));
        }

        guideArc.endAngle(scale(store.maxValue));

        svg.select("path.guide")
            .attr("width", 100)
            .attr("height", 100)
            .attr("class", styles.gaugeGuide)
            .attr("d", guideArc as any);

        const gaugeClassName = getGaugeClassName();

        svg.select("g.gauge")
            .selectAll("path")
            .data([store.currentValue])
            .join("path")
            .attr("class", gaugeClassName)
            .attr("d", valueArc as any);

        svg.select("g.number")
            .selectAll("text")
            .data([store.currentValue])
            .join("text")
            .attr("fill", "black")
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

                addSvgChildTags(selection, width, height);
            }
            renderGraph(selection);

            return api;
        }
    };

    return api;
}

function addSvgChildTags(
    selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
    width: number,
    height: number
) {
    const transform = `translate(${width / 2}, ${height / 2})`;

    selection.append("path").attr("class", "guide").attr("transform", transform);
    selection.append("g").attr("class", "gauge").attr("transform", transform);
    selection.append("path").attr("class", "scaleDarkGreen").attr("transform", transform);
    selection.append("path").attr("class", "scaleLightGreen").attr("transform", transform);
    selection.append("path").attr("class", "scaleYellow").attr("transform", transform);
    selection.append("path").attr("class", "scaleRed").attr("transform", transform);
    selection.append("g").attr("class", "number").attr("transform", transform);
}
