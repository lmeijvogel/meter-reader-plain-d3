import { PeriodDataTab } from "./periodData";
import { CurrentDataTab } from "./currentCharts";
import { Heatmaps } from "./heatmaps";
import { appStateFromLocation } from "./appStateFromLocation";
import { DayDescription } from "./models/periodDescriptions/DayDescription";
import { PeriodDescription } from "./models/periodDescriptions/PeriodDescription";

type TabName = "currentPage" | "periodPage" | "heatmapsPage";

let currentTab = "";

const updateLocation = (newPath: string) => {
    window.history.replaceState({}, "", newPath);
};

const periodDataTab = new PeriodDataTab(DayDescription.today(), updateLocation);
const currentDataTab = new CurrentDataTab(currentDataReceived, updateLocation);
const heatmapsTab = new Heatmaps(heatmapPeriodSelected, updateLocation);

periodDataTab.initializePage("#periodPage");
currentDataTab.initializePage("#currentPage");
heatmapsTab.initializePage("#heatmapsPage");

/* Initializing the currentTab is necessary for polling the current usage. */
currentDataTab.startGaugesPolling();

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

function currentDataReceived(values: { current: number; water: number }) {
    const element = document.querySelector("#currentTab");

    if (element) {
        element.innerHTML = `Nu (${Math.round(values.current)} W)`;
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

    const selectedTab = document.querySelector("#" + name);

    if (!selectedTab) {
        return;
    }

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

    const page = document.getElementById(name);

    if (!page) {
        console.warn(`Page with id '${name}' not found.`);
        return;
    }

    page.classList.add("visible");

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
        currentDataTab.stopGraphsPolling();
    }
}

for (const tab of document.getElementsByClassName("tab")) {
    tab.addEventListener("click", () => {
        if (tab.id !== currentTab) {
            selectTab(tab.id);
        }
    });
}
