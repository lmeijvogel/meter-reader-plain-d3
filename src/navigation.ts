import { DayDescription, PeriodDescription, YearDescription } from "./models/PeriodDescription";

const displayThresholdInPx = 60;

let windowWidth = getWindowWidth();

export function initializeNavigation(onPeriodChange: (periodDescription: PeriodDescription) => void) {
    let periodDescription: PeriodDescription | undefined;

    function enableOrDisableNavigation() {
        if (!periodDescription) return;

        const prevButton = document.getElementsByClassName("js-navigate-prev")[0].getElementsByTagName("button")[0];
        prevButton.disabled = periodDescription.previous().beforeFirstMeasurement();

        const nextButton = document.getElementsByClassName("js-navigate-next")[0].getElementsByTagName("button")[0];
        nextButton.disabled = periodDescription.next().isInFuture();

        const upButton = document.getElementsByClassName("js-navigate-up")[0].getElementsByTagName("button")[0];
        upButton.disabled = periodDescription instanceof YearDescription;
    }

    function addButtonEventListener(
        selector: string,
        handler: (periodDescription: PeriodDescription) => PeriodDescription | null
    ) {
        const elements = document.getElementsByClassName(selector);

        if (elements?.length) {
            elements[0].addEventListener("click", () => {
                if (periodDescription) {
                    const newPeriodDescription = handler(periodDescription);

                    if (newPeriodDescription) {
                        onPeriodChange(newPeriodDescription);
                    }
                }
            });
        }
    }
    addButtonEventListener("js-navigate-up", (periodDescription: PeriodDescription) => periodDescription?.up());
    addButtonEventListener("js-navigate-prev", (periodDescription: PeriodDescription) => periodDescription?.previous());
    addButtonEventListener("js-navigate-next", (periodDescription: PeriodDescription) => periodDescription?.next());
    addButtonEventListener("js-navigate-today", () => DayDescription.today());

    const onResize = () => {
        windowWidth = getWindowWidth();
    };
    window.addEventListener("resize", onResize);

    const onMouseMove = (event: any) => {
        setMouseCoords(event.clientX, event.pageY);
    };
    window.addEventListener("mousemove", onMouseMove);

    const api = {
        setPeriodDescription: (newPeriodDescription: PeriodDescription) => {
            periodDescription = newPeriodDescription;

            enableOrDisableNavigation();

            setPageTitle(periodDescription.toTitle());

            return api;
        }
    };

    return api;
}

function setPageTitle(title: string) {
    document.getElementsByClassName("js-page-title")[0].textContent = title;
}

function getWindowWidth() {
    const rects = document.body.getClientRects();
    return rects[0].width;
}

const setMouseCoords = (x: number, y: number) => {
    const mouseAtLeftEdge = x <= displayThresholdInPx;
    const mouseAtRightEdge = x >= windowWidth - displayThresholdInPx;
    const mouseAtTopEdge = y <= displayThresholdInPx;

    function showOrHideEdge(selector: string, isVisible: boolean) {
        const edge = document.getElementsByClassName(selector)[0];

        if (isVisible) {
            edge.classList.add("visible");
        } else {
            edge.classList.remove("visible");
        }
    }

    showOrHideEdge("js-buttons-top", mouseAtTopEdge);
    showOrHideEdge("js-buttons-left", mouseAtLeftEdge);
    showOrHideEdge("js-buttons-right", mouseAtRightEdge);
};
