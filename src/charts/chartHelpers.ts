export function getChartTextColor(): string {
    return getComputedStyle(document.documentElement).getPropertyValue("--color-text").trim() || "#333";
}

export const resizeObservers = new WeakMap<HTMLElement, ResizeObserver>();
