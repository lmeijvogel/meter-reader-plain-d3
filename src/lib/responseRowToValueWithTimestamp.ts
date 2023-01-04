import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

export type JsonResponseRow = [string, number];

export function responseRowToValueWithTimestamp(row: JsonResponseRow): ValueWithTimestamp {
    return {
        timestamp: new Date(Date.parse(row[0])),
        value: Number(row[1])
    };
}
