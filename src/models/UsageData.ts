export type UsageData = {
    time_stamp: string;
    label: number;
    gas: number;
    stroom: number;
    generation: number;
    back_delivery: number;
    water: number;
};

export type UsageField = Exclude<keyof UsageData, "time_stamp" | "label">;
