import { appStateFromLocation } from "../appStateFromLocation";
import { DayDescription } from "../models/periodDescriptions/DayDescription";
import { MonthDescription } from "../models/periodDescriptions/MonthDescription";
import { YearDescription } from "../models/periodDescriptions/YearDescription";

describe("appStateFromLocation", () => {
    it("returns the default when no path is set", () => {
        const actual = appStateFromLocation("");

        expect(actual).toEqual({
            activeTab: "period",
            periodDescription: DayDescription.today()
        });
    });

    it('returns the "now" tab when the path is "now"', () => {
        const actual = appStateFromLocation("/now");

        expect(actual).toEqual({
            activeTab: "now"
        });
    });

    it('returns the "heatmaps" tab when the path is "heatmaps"', () => {
        const actual = appStateFromLocation("/heatmaps");

        expect(actual).toEqual({
            activeTab: "heatmaps"
        });
    });

    describe("when a period is given", () => {
        it("returns a given year", () => {
            const actual = appStateFromLocation("/period/year/2022");

            expect(actual).toEqual({
                activeTab: "period",
                periodDescription: new YearDescription(2022)
            });
        });

        it("returns a given month", () => {
            const actual = appStateFromLocation("/period/month/2022/07");

            expect(actual).toEqual({
                activeTab: "period",
                periodDescription: new MonthDescription(2022, 6)
            });
        });

        it("returns a given day", () => {
            const actual = appStateFromLocation("/period/day/2022/07/18");

            expect(actual).toEqual({
                activeTab: "period",
                periodDescription: new DayDescription(2022, 6, 18)
            });
        });
    });
});
