import * as d3 from "d3";
import { BarChartApi } from "../charts/barChart";
import { Thermometer } from "../charts/thermometer";
import { createPeriodDataCardTitle } from "../createPeriodDataCardTitle";
import { PriceCalculator } from "../lib/PriceCalculator";
import { GasGraphDescription, TemperatuurGraphDescription } from "../models/GraphDescription";
import { PeriodDescription } from "../models/periodDescriptions/PeriodDescription";
import { ValueWithTimestamp } from "../models/ValueWithTimestamp";
import { setCardTitle } from "../vizCard";
import { fetchChartData } from "./fetchChartData";

export function fetchAndDrawGasChart(periodDescription: PeriodDescription, temperatureRequest: Promise<Map<string, ValueWithTimestamp[]>>, gasChartApi: BarChartApi, thermometer: Thermometer, shouldClearCanvas: boolean, priceCalculator: PriceCalculator) {
    const periodGasContainer = d3.select("#gas_period_data");

    Promise.all([fetchChartData("gas", periodDescription, periodGasContainer), temperatureRequest]).then((result) => {
        const [gasValues, temperatureValues] = result;

        if (!gasValues.requestedPeriodDescription.equals(periodDescription)) {
            return;
        }

        const graphDescription = new GasGraphDescription(periodDescription);

        gasChartApi.clearCanvas(shouldClearCanvas).data(periodDescription, graphDescription, gasValues.result);
        const outsideTemperatures = temperatureValues.get("buiten");

        let thermometerContainer = periodGasContainer.select(".thermometer");

        if (periodDescription.period === "day") {
            if (!thermometerContainer.node()) {
                thermometerContainer = periodGasContainer.append("svg") as any;
                thermometerContainer.attr("class", "thermometer");
                thermometer.prepare(thermometerContainer);
                thermometer.hide(thermometerContainer);
            }
        } else {
            thermometer.hide(thermometerContainer);
        }

        gasChartApi.removeLineData();

        // If there aren't enough temperature measurements (which happens when
        // KNMI didn't validate the measurements yet), the thermometer will show
        // incomplete data, so don't show it then.
        if (outsideTemperatures && outsideTemperatures.length > 12) {
            if (periodDescription.period === "day") {
                const minimum = d3.min(outsideTemperatures, (el) => el.value) ?? 0;
                const maximum = d3.max(outsideTemperatures, (el) => el.value) ?? 0;

                thermometer.show(thermometerContainer);
                thermometer.draw({ minimum, maximum }, thermometerContainer);
            } else {
                thermometer.hide(thermometerContainer);
                gasChartApi.addLineData(
                    outsideTemperatures,
                    new TemperatuurGraphDescription(periodDescription)
                );
            }
        } else {
            thermometer.hide(thermometerContainer);
        }

        const cardTitle = createPeriodDataCardTitle(gasValues.result, "gas", graphDescription, priceCalculator);
        setCardTitle(periodGasContainer, cardTitle);

        gasChartApi.call(periodGasContainer.select(".chart"));
    });
}


