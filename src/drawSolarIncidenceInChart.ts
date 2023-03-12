import * as d3 from "d3";
import { addDays } from "date-fns";
import { calculatePotentialIncidentSunlight } from "./lib/calculatePotentialIncidentSunlight";
import { PeriodDescription } from "./models/periodDescriptions/PeriodDescription";

type FieldNames = "east" | "west" | "total";

export function drawSolarIncidenceInChart(
    selection: d3.Selection<d3.BaseType, unknown, HTMLElement, any>,
    periodDescription: PeriodDescription,
    scaleX: d3.ScaleTime<number, number, never>,
    scaleY: d3.ScaleLinear<number, number, never>
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

    const lineGenerator = d3
        .line<{ date: Date; value: number }>()
        .x((d) => scaleX(d.date))
        .y((d) => scaleY(d.value));

    const fields: FieldNames[] = ["total"]; // ["east", "west", "total"];

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
            .attr("stroke-width", 1)
            .attr("d", lineGenerator);
    }
}
