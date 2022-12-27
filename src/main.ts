import { DayDescription, PeriodDescription } from "./models/PeriodDescription";
import { PeriodDataTab } from "./periodData";
import { CurrentDataTab } from "./currentCharts";
import { Heatmaps } from "./heatmaps";

let currentTab = "";

let periodDataTab: PeriodDataTab = new PeriodDataTab();
let currentDataTab: CurrentDataTab = new CurrentDataTab();
let heatmapTab: Heatmaps = new Heatmaps();

selectTab("currentTab");

function heatmapPeriodSelected(periodDescription: PeriodDescription) {
    selectTab("periodTab");
    periodDataTab?.initializeTab("periodPage", periodDescription);
}

function selectTab(name: string) {
    const tabs = document.getElementsByClassName("tab");
    for (const tab of tabs) {
        tab.classList.remove("active");
    }

    const selectedTab = document.getElementById(name)!;

    selectedTab.classList.add("active");

    showPage(selectedTab.getAttribute("data-page")!, currentTab);

    currentTab = name;
}

/* previousTab is the tab *before* the tab switch */
function showPage(name: string, previousTab: string) {
    const pages = document.getElementsByClassName("page");

    for (const page of pages) {
        page.classList.remove("visible");
    }

    document.getElementById(name)?.classList.add("visible");

    switch (name) {
        case "currentPage":
            if (!currentDataTab?.isInitialized) {
                currentDataTab?.initializeTab("currentPage");
            }
            currentDataTab.initializeCurrentCharts();
            break;
        case "periodPage":
            if (!periodDataTab?.isInitialized) {
                periodDataTab?.initializeTab("periodPage", DayDescription.today());
            }
            break;
        case "heatmapPage":
            if (!heatmapTab.isInitialized) {
                heatmapTab.initializeTab("heatmapPage", heatmapPeriodSelected);
            }
            break;
    }

    if (previousTab === "currentTab" && name !== "currentPage") {
        currentDataTab.stopPolling();
    }
}

for (const tab of document.getElementsByClassName("tab")) {
    tab.addEventListener("click", () => {
        if (tab.id !== currentTab) {
            selectTab(tab.id);
        }
    });
}
