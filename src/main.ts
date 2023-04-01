import { PeriodDataTab } from "./periodData";
import { CurrentDataTab } from "./currentCharts";
import { Heatmaps } from "./heatmaps";
import { appStateFromLocation } from "./appStateFromLocation";
import { DayDescription } from "./models/periodDescriptions/DayDescription";
import { PeriodDescription } from "./models/periodDescriptions/PeriodDescription";

type Page = "current" | "period" | "heatmaps";

let currentTab: Page = "current";

const updateLocation = (newPath: string) => {
    window.history.replaceState({}, "", newPath);
};

const periodDataTab = new PeriodDataTab(DayDescription.today(), updateLocation);
const currentDataTab = new CurrentDataTab(currentDataReceived, updateLocation);
const heatmapsTab = new Heatmaps(heatmapPeriodSelected, updateLocation);

periodDataTab.initializePage("#period");
currentDataTab.initializePage("#current");
heatmapsTab.initializePage("#heatmaps");

/* Initializing the currentDataTab is necessary for polling the current usage. */
currentDataTab.startGaugesPolling();

showInitialPage();

for (const tab of document.getElementsByClassName("tab")) {
    tab.addEventListener("click", () => {
        const page = tab.getAttribute("data-page") as Page;

        if (page !== currentTab) {
            selectTabAndShowPage(page);
        }
    });
}

function showInitialPage() {
    const initialState = appStateFromLocation(window.location.pathname);

    switch (initialState.activeTab) {
        case "now":
            selectTabAndShowPage("current");
            break;
        case "heatmaps":
            selectTabAndShowPage("heatmaps");
            break;
        case "period":
            selectTabAndShowPage("period");
            periodDataTab.retrieveAndDrawPeriodCharts(initialState.periodDescription);
            break;
    }
}

function currentDataReceived(values: { current: number; water: number }) {
    const element = document.querySelector("#currentTab");

    if (element) {
        element.innerHTML = `Nu (${Math.round(values.current)} W)`;
    }
}

function heatmapPeriodSelected(periodDescription: PeriodDescription) {
    selectTabAndShowPage("period");
    periodDataTab.retrieveAndDrawPeriodCharts(periodDescription);
}

function selectTabAndShowPage(name: Page) {
    const allTabs = document.getElementsByClassName("tab");
    for (const tab of allTabs) {
        tab.classList.remove("active");
    }

    const selectedTab = document.querySelector(`.tab[data-page=${name}]`);

    if (!selectedTab) {
        console.error(`Could not find tab ${name}`);
        return;
    }

    selectedTab.classList.add("active");

    currentTab = name;

    showPage(name, currentTab);
}

/* previous is the page *before* the page switch */
function showPage(name: Page, previous: Page) {
    const pages = document.getElementsByClassName("page");

    for (const page of pages) {
        page.classList.remove("visible");
    }

    const page = document.querySelector(`.page[data-page=${name}]`);

    if (!page) {
        console.warn(`Page with id '${name}' not found.`);
        return;
    }

    page.classList.add("visible");

    switch (name) {
        case "current":
            currentDataTab.tabSelected();
            break;
        case "period":
            periodDataTab.tabSelected();
            break;
        case "heatmaps":
            heatmapsTab.tabSelected();
            break;
    }

    if (previous === "current" && name !== "current") {
        currentDataTab.stopGraphsPolling();
    }
}
