import * as d3 from "d3";
import { GetTimesResult } from "suncalc";

export function drawTimeBandsInChart(
    g: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
    times: GetTimesResult,
    scaleX: d3.ScaleTime<number, number, never>,
    bandTop: number,
    bandHeight: number,
    graphStart: number,
    graphEnd: number
) {
    g.selectChildren().remove();

    const nightColor = "#009"; // Sun > 18deg below horizon
    const darkTwilightColor = "#559"; // Sun > 12deg below horizon
    const lightTwilightColor = "#aad"; // Sun > 0deg below horizon
    const sunriseColor = "#dd8";
    const dayColor = "#fff";

    const timeBands: { startX: number; endX: number; color: string }[] = [];

    const night = times.night;

    if (isNaN(night.getTime())) {
        /* No "deep" night today, so just a long dusk */
        timeBands.push({
            startX: calculateX(times.dusk, scaleX)!,
            endX: graphEnd,
            color: darkTwilightColor
        });

        timeBands.push({
            startX: graphStart,
            endX: calculateX(times.dawn, scaleX)!,
            color: darkTwilightColor
        });
    } else {
        if (night.getHours() > 12) {
            // Dusk is one entry, and night crosses midnight
            timeBands.push({
                startX: calculateX(times.dusk, scaleX)!,
                endX: calculateX(times.night, scaleX)!,
                color: darkTwilightColor
            });

            timeBands.push({
                startX: calculateX(night, scaleX)!,
                endX: graphEnd,
                color: nightColor
            });

            timeBands.push({
                startX: graphStart,
                endX: calculateX(times.nightEnd, scaleX)!,
                color: nightColor
            });
        } else {
            // Night is one entry and dusk crosses midnight
            timeBands.push({
                startX: calculateX(night, scaleX)!,
                endX: calculateX(times.nightEnd, scaleX)!,
                color: nightColor
            });

            timeBands.push({
                startX: calculateX(times.dusk, scaleX)!,
                endX: graphEnd,
                color: darkTwilightColor
            });

            timeBands.push({
                startX: graphStart,
                endX: calculateX(times.night, scaleX)!,
                color: darkTwilightColor
            });
        }

        timeBands.push({
            startX: calculateX(times.nightEnd, scaleX)!,
            endX: calculateX(times.dawn, scaleX)!,
            color: darkTwilightColor
        });
    }

    [
        {
            startTime: times.dawn,
            color: lightTwilightColor
        },
        {
            startTime: times.sunrise,
            color: sunriseColor
        },
        {
            startTime: times.sunriseEnd,
            color: dayColor
        },
        {
            startTime: times.sunsetStart,
            color: sunriseColor
        },
        {
            startTime: times.sunset,
            color: lightTwilightColor
        },
        {
            // This one is not actually used
            startTime: times.dusk,
            color: darkTwilightColor
        }
    ].forEach(({ startTime, color }, index, array) => {
        const endTime = array[index + 1]?.startTime;

        if (!endTime) {
            return;
        }

        timeBands.push({
            startX: calculateX(startTime, scaleX)!,
            endX: calculateX(endTime, scaleX)!,
            color: color
        });
    });

    timeBands.forEach(({ startX, endX, color }) => {
        g.append("rect")
            .attr("x", startX)
            .attr("y", bandTop)
            .attr("width", endX - startX)
            .attr("height", bandHeight)
            .attr("fill", color)
            .attr("fill-opacity", 0.15);
    });
}

function calculateX(date: Date, scaleX: d3.ScaleTime<number, number, never>): number | null {
    return scaleX(date);
}
