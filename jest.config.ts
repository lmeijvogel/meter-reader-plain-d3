import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    moduleNameMapper: {
        d3: "<rootDir>/node_modules/d3/dist/d3.min.js"
    }
};

export default config;
