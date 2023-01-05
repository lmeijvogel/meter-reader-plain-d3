import { DayDescription, PeriodDescription } from "./models/PeriodDescription";
import { PeriodDataTab } from "./periodData";
import { CurrentDataTab } from "./currentCharts";
import { Heatmaps } from "./heatmaps";

type TabName = "currentPage" | "periodPage" | "heatmapPage";

let currentTab = "";

let periodDataTab: PeriodDataTab = new PeriodDataTab();
let currentDataTab: CurrentDataTab = new CurrentDataTab(currentDataReceived);
let heatmapTab: Heatmaps = new Heatmaps(heatmapPeriodSelected);

periodDataTab.initializeTab("#periodPage");
currentDataTab.initializeTab("#currentPage");
heatmapTab.initializeTab("#heatmapPage");

/* Initializing the currentTab is necessary for polling the current usage. */
currentDataTab.startCurrentUsagePolling();
selectTab("periodTab");
periodDataTab.retrieveAndDrawPeriodCharts(DayDescription.today());

function currentDataReceived(currentValueInW: number) {
    const element = document.querySelector("#currentTab");

    if (!!element) {
        element.innerHTML = `Nu (${currentValueInW} W)`;
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
            currentDataTab.initializeCurrentCharts();
            break;
        case "periodPage":
            periodDataTab.initializeNavigation();
            break;
        case "heatmapPage":
            heatmapTab.loadData();
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
