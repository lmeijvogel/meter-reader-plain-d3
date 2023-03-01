import * as d3 from "d3";
import { set } from "date-fns";
import { getPosition } from "suncalc";

import { HouseLocation } from "../models/HouseLocation";

const solarRigMultiplier = 2.4;

export function calculatePotentialIncidentSunlight(date: Date, roofSide: "east" | "west"): number {
    // From: https://www.pveducation.org/pvcdrom/properties-of-sunlight/arbitrary-orientation-and-tilt
    //
    // S_module = S_incident[cos(α)sin(β)cos(ψ - θ) + sin(α)cos(β)]
    //
    // names:
    // α: alpha: Sun elevation angle
    // β: beta: Module tilt angle
    // θ: theta: Sun azimuth angle
    // ψ: psi: Module azimuth angle

    const panelTilt = deg2rad(50);
    const panelAzimuth = deg2rad(roofSide === "east" ? 92 : 268);

    const { azimuth: sunAzimuth, altitude: sunAltitude } = getPosition(
        date,
        HouseLocation.latitude,
        HouseLocation.longitude
    );

    // If the sun is below the horizon, it will probably not hit the
    // panels :)
    if (sunAltitude < 0) {
        return 0;
    }

    // Calculate actual value: https://www.pveducation.org/pvcdrom/properties-of-sunlight/air-mass#formula
    const airMass = 1 / Math.cos(Math.PI / 2 - sunAltitude);

    // Moet de formule niet S_incident omvatten?
    // S_horiz = S_incident * sin α
    // Dus S_incident = S_horiz / sin α

    const factor =
        Math.cos(sunAltitude) * Math.sin(panelTilt) * Math.cos(panelAzimuth - sunAzimuth) +
        Math.sin(sunAltitude) * Math.cos(panelTilt);

    return Math.max(0, (solarRigMultiplier * factor) / airMass);
}

export function getMaximumIncidentSunlight(date: Date) {
    const startTime = set(date, { hours: 11, minutes: 0, seconds: 0 });
    const endTime = set(date, { hours: 15, minutes: 0, seconds: 0 });

    return d3.timeMinutes(startTime, endTime, 15).reduce<number>((maximum: number, time: Date) => {
        const incidence =
            calculatePotentialIncidentSunlight(time, "east") + calculatePotentialIncidentSunlight(time, "west");

        if (incidence > maximum) {
            return incidence;
        }

        return maximum;
    }, 0);
}

function deg2rad(degrees: number): number {
    return (2 * Math.PI * degrees) / 360;
}
