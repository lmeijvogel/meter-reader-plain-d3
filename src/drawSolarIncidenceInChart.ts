import * as d3 from "d3";
import { addDays } from "date-fns";
import { getPosition } from "suncalc";
import { HouseLocation } from "./models/HouseLocation";
import { PeriodDescription } from "./models/PeriodDescription";

type FieldNames = "east" | "west" | "total";

export function drawSolarIncidenceInChart(
    selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
    periodDescription: PeriodDescription,
    minimumY: number,
    maximumY: number,
    scaleX: d3.ScaleTime<number, number, never>
) {
    const day = periodDescription.toDate();
    const quarters = d3.timeMinute.range(day, addDays(day, 1), 15);

    const rawData = quarters.map((q) => ({
        date: q,
        east: calculatePotentialIncidentSunlight(q, "east"),
        west: calculatePotentialIncidentSunlight(q, "west")
    }));

    const data = rawData.map((entry) => ({
        ...entry,
        total: entry.east + entry.west
    }));

    const scaleYForThisGraph = d3
        .scaleLinear()
        .domain([0, d3.max(data, (v) => v.value) ?? 1])
        .range([maximumY, minimumY])
        .clamp(true);

    const lineGenerator = d3
        .line<{ date: Date; value: number }>()
        .curve(d3.curveNatural)
        .x((d) => scaleX(d.date))
        .y((d) => scaleYForThisGraph(d.value));

    const fields: FieldNames[] = ["east", "west", "total"];
    for (const field of fields) {
        selection.select(`.${field}`).remove();

        const g = selection.append("g").attr("class", field);

        var path = g
            .selectAll(`path.line`)
            .data([data.map((el) => ({ date: el.date, value: el[field] }))])
            .join("path");

        path.attr("class", `line`)
            .attr("fill", "none")
            .attr("stroke", field === "total" ? "#f00" : "#f80")
            .attr("stroke-width", 2)
            .attr("d", lineGenerator);
    }
}

function calculatePotentialIncidentSunlight(date: Date, roofSide: "east" | "west") {
    // From: https://www.pveducation.org/pvcdrom/properties-of-sunlight/arbitrary-orientation-and-tilt
    //
    // S_module = S_incident[cos(α)sin(β)cos(ψ - θ) + sin(α)cos(β)]
    //
    // names:
    // α: alpha: Sun elevation angle
    // β: beta: Module tilt angle
    // θ: theta: Sun azimuth angle
    // ψ: psi: Module azimuth angle

    const panelOrientationDegrees = roofSide === "east" ? 90 : 270;
    const panelAzimuthDegrees = 50;

    const { azimuth, altitude } = getPosition(date, HouseLocation.latitude, HouseLocation.longitude);

    if (altitude < 0) {
        return 0;
    }
    // Calculate actual value: https://www.pveducation.org/pvcdrom/properties-of-sunlight/air-mass#formula
    const airMass = 1 / Math.cos(Math.PI / 2 - altitude);

    const factor =
        Math.cos(altitude) *
            Math.sin(deg2rad(panelAzimuthDegrees)) *
            Math.cos(deg2rad(panelOrientationDegrees) - azimuth) +
        Math.sin(altitude) * Math.cos(deg2rad(panelAzimuthDegrees));

    return Math.max(0, factor / airMass);
}

function deg2rad(degrees: number): number {
    return (2 * Math.PI * degrees) / 360;
}
