import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

type Row = [string, number];

export function responseRowToValueWithTimestamp(row: Row): ValueWithTimestamp {
    return {
        timestamp: new Date(Date.parse(row[0])),
        value: Math.max(0, row[1])
    };
}
