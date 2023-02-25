import { DayDescription, PeriodDescription } from "./models/PeriodDescription";
import { PeriodDataTab } from "./periodData";
import { CurrentDataTab } from "./currentCharts";
import { Heatmaps } from "./heatmaps";
import { appStateFromLocation } from "./appStateFromLocation";

type TabName = "currentPage" | "periodPage" | "heatmapsPage";

let currentTab = "";

const updateLocation = (newPath: string) => {
    window.history.replaceState({}, "", newPath);
};

let periodDataTab = new PeriodDataTab(DayDescription.today(), updateLocation);
let currentDataTab = new CurrentDataTab(currentDataReceived, updateLocation);
let heatmapsTab = new Heatmaps(heatmapPeriodSelected, updateLocation);

periodDataTab.initializePage("#periodPage");
currentDataTab.initializePage("#currentPage");
heatmapsTab.initializePage("#heatmapsPage");

/* Initializing the currentTab is necessary for polling the current usage. */
currentDataTab.startCurrentUsagePolling();

const initialState = appStateFromLocation(window.location.pathname);

switch (initialState.activeTab) {
    case "now":
        selectTab("currentTab");
        break;
    case "heatmaps":
        selectTab("heatmapsTab");
        break;
    case "period":
        selectTab("periodTab");
        periodDataTab.retrieveAndDrawPeriodCharts(initialState.periodDescription);
        break;
}

function currentDataReceived(currentValueInW: number) {
    const element = document.querySelector("#currentTab");

    if (!!element) {
        element.innerHTML = `Nu (${Math.round(currentValueInW)} W)`;
    }
}

function heatmapPeriodSelected(periodDescription: PeriodDescription) {
    selectTab("periodTab");
    periodDataTab.retrieveAndDrawPeriodCharts(periodDescription);
}

function selectTab(name: string) {
    const tabs = document.getElementsByClassName("tab");
    for (const tab of tabs) {
        tab.classList.remove("active");
    }

    const selectedTab = document.querySelector("#" + name)!;

    selectedTab.classList.add("active");

    showPage(selectedTab.getAttribute("data-page") as TabName, currentTab);

    currentTab = name;
}

/* previousTab is the tab *before* the tab switch */
function showPage(name: TabName, previousTab: string) {
    const pages = document.getElementsByClassName("page");

    for (const page of pages) {
        page.classList.remove("visible");
    }

    document.querySelector("#" + name)?.classList.add("visible");

    switch (name) {
        case "currentPage":
            currentDataTab.tabSelected();
            break;
        case "periodPage":
            periodDataTab.tabSelected();
            break;
        case "heatmapsPage":
            heatmapsTab.tabSelected();
            break;
    }

    if (previousTab === "currentTab" && name !== "currentPage") {
        currentDataTab.stopRecentPowerPolling();
    }
}

for (const tab of document.getElementsByClassName("tab")) {
    tab.addEventListener("click", () => {
        if (tab.id !== currentTab) {
            selectTab(tab.id);
        }
    });
}
