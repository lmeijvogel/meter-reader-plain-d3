import { DayDescription, MonthDescription, PeriodDescription, YearDescription } from "./models/PeriodDescription";

export type AppState =
    | {
          activeTab: "now" | "heatmaps";
      }
    | {
          activeTab: "period";
          periodDescription: PeriodDescription;
      };

export function appStateFromLocation(pathName: string): AppState {
    if (pathName === "/now") {
        return {
            activeTab: "now"
        };
    } else if (pathName === "/heatmaps") {
        return {
            activeTab: "heatmaps"
        };
    } else if (pathName.startsWith("/period")) {
        return {
            activeTab: "period",
            periodDescription: parsePath(pathName)
        };
    }

    return {
        activeTab: "period",
        periodDescription: DayDescription.today()
    };
}

function parsePath(path: string): PeriodDescription {
    let parts = path.split("/").slice(2);

    const period = parts.shift();

    if (period === "year") {
        const year = parseInt(parts[0]);

        return new YearDescription(year);
    }

    if (period === "month") {
        const [year, month] = parts.map((p) => parseInt(p, 10));

        return new MonthDescription(year, month - 1);
    }

    if (period === "day") {
        const [year, month, day] = parts.map((p) => parseInt(p, 10));

        return new DayDescription(year, month - 1, day);
    }

    return DayDescription.today();
}
