import * as d3 from "d3";
import { endOfDay, set, startOfDay } from "date-fns";
import { GetTimesResult } from "suncalc";

type TimeBand = {
    name: string;
    start: Date;
    end: Date;
    fromColor: string;
    toColor: string;
};

export function drawTimeBandsInChart(
    g: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
    times: GetTimesResult,
    scaleX: d3.ScaleTime<number, number, never>,
    bandTop: number,
    bandHeight: number
) {
    g.selectChildren().remove();
    g.append("defs");

    const dayStart = startOfDay(times.sunrise);
    const dayEnd = endOfDay(times.sunrise);

    const dawn: TimeBand = {
        name: "dawn",
        start: times.dawn,
        end: times.sunrise,
        fromColor: "twilight",
        toColor: "sun"
    };

    const day: TimeBand = {
        name: "day",
        start: times.sunriseEnd,
        end: times.sunsetStart,
        fromColor: "sun",
        toColor: "day"
    };

    const preDusk: TimeBand = {
        name: "pre-dusk",
        start: times.sunset,
        end: times.dusk,
        fromColor: "sun",
        toColor: "twilight"
    };

    let bands: TimeBand[] = [];

    const hasNight = !isNaN(times.night.getTime());

    if (hasNight) {
        const preDawn = {
            name: "pre-dawn",
            start: times.nightEnd,
            end: times.dawn,
            fromColor: "night",
            toColor: "twilight"
        };

        if (sameDay(times.night, dayStart)) {
            // Night starts in the evening, so no early dusk
            const earlyNight = {
                name: "early-night",
                start: dayStart,
                end: times.nightEnd,
                fromColor: "night",
                toColor: "night"
            };

            const lateDusk = {
                name: "late-dusk",
                start: times.dusk,
                end: times.night,
                fromColor: "twilight",
                toColor: "night"
            };
            const lateNight = {
                name: "late-night",
                start: times.night,
                end: dayEnd,
                fromColor: "night",
                toColor: "night"
            };

            bands = [earlyNight, preDawn, dawn, day, preDusk, lateDusk, lateNight];
        } else {
            // Night start after midnight, so no late night
            const nightStart = toToday(times.night, dayStart);

            const earlyDusk = {
                name: "early-dusk",
                start: dayStart,
                end: nightStart,
                fromColor: "twilight",
                toColor: "night"
            };
            const earlyNight = {
                name: "early-night",
                start: nightStart,
                end: times.nightEnd,
                fromColor: "night",
                toColor: "night"
            };

            const lateDusk = {
                name: "late-dusk",
                start: times.dusk,
                end: dayEnd,
                fromColor: "twilight",
                toColor: "twilight"
            };

            bands = [earlyDusk, earlyNight, preDawn, dawn, day, preDusk, lateDusk];
        }
    } else {
        /* In summer, there is no "deep" night */
        const earlyDusk = {
            name: "early-dusk",
            start: dayStart,
            end: times.dawn,
            fromColor: "twilight",
            toColor: "twilight"
        };
        const lateDusk = {
            name: "late-dusk",
            start: times.dusk,
            end: dayEnd,
            fromColor: "twilight",
            toColor: "twilight"
        };

        bands = [earlyDusk, dawn, day, preDusk, lateDusk];
    }

    for (const lightPeriod of bands) {
        addTimeBand(lightPeriod, scaleX, g, bandTop, bandHeight);
    }
}

function addTimeBand(
    timeBand: TimeBand,
    scaleX: d3.ScaleTime<number, number, never>,
    g: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
    bandTop: number,
    bandHeight: number
) {
    const startX = scaleX(timeBand.start);
    const endX = scaleX(timeBand.end);

    const gradientId = `timeBands-${timeBand.name}-gradient`;

    const gradient = g.select("defs").append("linearGradient").attr("id", gradientId);

    gradient.append("stop").attr("offset", "0%").attr("stop-color", `var(--color-${timeBand.fromColor})`);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", `var(--color-${timeBand.toColor})`);

    g.append("rect")
        .attr("x", startX)
        .attr("y", bandTop)
        .attr("width", endX - startX)
        .attr("height", bandHeight)
        .attr("fill", `url(#${gradientId})`)
        .attr("fill-opacity", "0.3")
        .attr("data-name", timeBand.name);
}

function sameDay(one: Date, two: Date): boolean {
    return one.getDate() === two.getDate();
}
function toToday(date: Date, current: Date): Date {
    return set(date, { year: current.getFullYear(), month: current.getMonth(), date: current.getDate() });
}
