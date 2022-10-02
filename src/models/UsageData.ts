export type UsageData = {
    time_stamp: string;
    label: number;
    gas: number;
    stroom: number;
    water: number;
};

export type UsageField = keyof Omit<UsageData, "time_stamp" | "label">;
