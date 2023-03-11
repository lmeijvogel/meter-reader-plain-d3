import * as d3 from "d3";
import { endOfDay, set, startOfDay } from "date-fns";
import { GetTimesResult } from "suncalc";

type LinearGradient = {
    type: "linear";
    fromColor: string;
    toColor: string;
};

type ParameterizedGradient = {
    type: "parameterized";
    colors: {
        stop: string;
        color: string;
    }[];
};

type TimeBand = {
    name: string;
    start: Date;
    end: Date;
    gradient: LinearGradient | ParameterizedGradient;
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
        gradient: {
            type: "linear",
            fromColor: "twilight",
            toColor: "sun"
        }
    };

    const day: TimeBand = {
        name: "day",
        start: times.sunriseEnd,
        end: times.sunsetStart,
        gradient: {
            type: "parameterized",
            colors: [
                { stop: "0%", color: "sun" },
                { stop: "7%", color: "day" },
                { stop: "93%", color: "day" },
                { stop: "100%", color: "sun" }
            ]
        }
    };

    const preDusk: TimeBand = {
        name: "pre-dusk",
        start: times.sunset,
        end: times.dusk,
        gradient: {
            type: "linear",
            fromColor: "sun",
            toColor: "twilight"
        }
    };

    let bands: TimeBand[] = [];

    const hasNight = !isNaN(times.night.getTime());

    if (hasNight) {
        const preDawn: TimeBand = {
            name: "pre-dawn",
            start: times.nightEnd,
            end: times.dawn,
            gradient: {
                type: "linear",
                fromColor: "night",
                toColor: "twilight"
            }
        };

        if (sameDay(times.night, dayStart)) {
            // Night starts in the evening, so no early dusk
            const earlyNight: TimeBand = {
                name: "early-night",
                start: dayStart,
                end: times.nightEnd,
                gradient: {
                    type: "linear",
                    fromColor: "night",
                    toColor: "night"
                }
            };

            const lateDusk: TimeBand = {
                name: "late-dusk",
                start: times.dusk,
                end: times.night,
                gradient: {
                    type: "linear",
                    fromColor: "twilight",
                    toColor: "night"
                }
            };
            const lateNight: TimeBand = {
                name: "late-night",
                start: times.night,
                end: dayEnd,
                gradient: {
                    type: "linear",
                    fromColor: "night",
                    toColor: "night"
                }
            };

            bands = [earlyNight, preDawn, dawn, day, preDusk, lateDusk, lateNight];
        } else {
            // Night start after midnight, so no late night
            const nightStart = toToday(times.night, dayStart);

            const earlyDusk: TimeBand = {
                name: "early-dusk",
                start: dayStart,
                end: nightStart,
                gradient: {
                    type: "linear",
                    fromColor: "twilight",
                    toColor: "night"
                }
            };

            const earlyNight: TimeBand = {
                name: "early-night",
                start: nightStart,
                end: times.nightEnd,
                gradient: {
                    type: "linear",
                    fromColor: "night",
                    toColor: "night"
                }
            };

            const lateDusk: TimeBand = {
                name: "late-dusk",
                start: times.dusk,
                end: dayEnd,
                gradient: {
                    type: "linear",
                    fromColor: "twilight",
                    toColor: "twilight"
                }
            };

            bands = [earlyDusk, earlyNight, preDawn, dawn, day, preDusk, lateDusk];
        }
    } else {
        /* In summer, there is no "deep" night */
        const earlyDusk: TimeBand = {
            name: "early-dusk",
            start: dayStart,
            end: times.dawn,
            gradient: {
                type: "linear",
                fromColor: "twilight",
                toColor: "twilight"
            }
        };
        const lateDusk: TimeBand = {
            name: "late-dusk",
            start: times.dusk,
            end: dayEnd,
            gradient: {
                type: "linear",
                fromColor: "twilight",
                toColor: "twilight"
            }
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

    const gradientSpec = timeBand.gradient;

    switch (gradientSpec.type) {
        case "linear":
            gradient.append("stop").attr("offset", "0%").attr("stop-color", `var(--color-${gradientSpec.fromColor})`);
            gradient.append("stop").attr("offset", "100%").attr("stop-color", `var(--color-${gradientSpec.toColor})`);
            break;
        case "parameterized":
            for (const { stop, color } of gradientSpec.colors) {
                gradient.append("stop").attr("offset", stop).attr("stop-color", `var(--color-${color})`);
            }
    }

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
