import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

// TODO: Any
export function responseRowToValueWithTimestamp(row: any): ValueWithTimestamp {
    return {
        timestamp: new Date(Date.parse(row[0])),
        value: row[1]
    };
}
