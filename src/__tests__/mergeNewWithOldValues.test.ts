import assert from "assert";
import { differenceInSeconds, isAfter, isBefore, isEqual, subMinutes } from "date-fns";
import fs from "fs";

import { mergeNewWithOldValues } from "../helpers/mergeNewWithOldValues";
import { responseRowToValueWithTimestamp } from "../helpers/responseRowToValueWithTimestamp";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";

type ResponseJson = {
    current: [[string, number]];
};

describe("mergeNewWithOldValues", () => {
    it("works if there is only new data", () => {
        const oldValues: ValueWithTimestamp[] = [];
        const newValues = [
            ["2022-11-20T19:02:06.000000000+00:00", 0.4003333333333334],
            ["2022-11-20T19:02:10.813632216+00:00", 0.3932]
        ].map(responseRowToValueWithTimestamp);

        const result = mergeNewWithOldValues(newValues, oldValues);

        expect(result.length).toEqual(2);
    });

    it("skips existing data", () => {
        const oldValues: ValueWithTimestamp[] = [
            ["2022-11-20T19:02:00.000000000+00:00", 0.2003333333333334],
            ["2022-11-20T19:02:06.000000000+00:00", 0.4003333333333334]
        ].map(responseRowToValueWithTimestamp);

        [];
        const newValues = [
            ["2022-11-20T19:02:06.000000000+00:00", 0.4003333333333334],
            ["2022-11-20T19:02:12.000000000+00:00", 0.3932]
        ].map(responseRowToValueWithTimestamp);

        const result = mergeNewWithOldValues(newValues, oldValues);

        expect(result.length).toEqual(3);
    });

    it("correctly appends data", () => {
        const oldValues = readFromFile(`${__dirname}/01-60minutes.json`).current.map(responseRowToValueWithTimestamp);
        const newValues = readFromFile(`${__dirname}/02-06minutes.json`).current.map(responseRowToValueWithTimestamp);

        const result = mergeNewWithOldValues(newValues, oldValues);

        const lastOldTimestamp = new Date(Date.UTC(2022, 10, 20, 19, 2, 6));
        const firstNewTimestamp = new Date(Date.UTC(2022, 10, 20, 19, 2, 12));

        expect(result.find((r) => isEqual(r.timestamp, lastOldTimestamp))).toBeTruthy();
        expect(result.find((r) => isEqual(r.timestamp, firstNewTimestamp))).toBeTruthy();

        expect(result.length).toEqual(oldValues.length + newValues.length - 5 - 1);

        assertCorrectTimestamps(result, 6);
    });

    it("correctly removes old data", () => {
        const cutoffDate = new Date(Date.UTC(2022, 10, 20, 18, 52));

        const oldValues = readFromFile(`${__dirname}/01-60minutes.json`).current.map(responseRowToValueWithTimestamp);
        const newValues = readFromFile(`${__dirname}/02-06minutes.json`).current.map(responseRowToValueWithTimestamp);

        expect(oldValues.some((value) => isBefore(value.timestamp, cutoffDate))).toBeTruthy();

        const result = mergeNewWithOldValues(newValues, oldValues, cutoffDate);

        expect(result.every((value) => isAfter(value.timestamp, cutoffDate))).toBeTruthy();
    });
});

function readFromFile(path: string): ResponseJson {
    return JSON.parse(fs.readFileSync(path).toString());
}

function assertCorrectTimestamps(result: ValueWithTimestamp[], expectedDifference: number) {
    for (let i = 1; i < result.length - 1; i++) {
        const prev = result[i - 1];
        const curr = result[i];

        const diff = differenceInSeconds(curr.timestamp, prev.timestamp);

        if (diff != expectedDifference) {
            expect(differenceInSeconds(curr.timestamp, prev.timestamp)).toEqual(6);
        }
    }
}
