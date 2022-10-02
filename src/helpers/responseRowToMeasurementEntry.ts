import { MeasurementResponse } from "../App";
import { MeasurementEntry } from "../models/MeasurementEntry";

export function responseRowToMeasurementEntry(row: MeasurementResponse): MeasurementEntry {
    return {
        timestamp: new Date(Date.parse(row[0])),
        value: row[1]
    };
}
