import { DayDescription, PeriodDescription, YearDescription } from "./models/PeriodDescription";

export function initKeyboardListener(
    periodSelected: (periodDescription: PeriodDescription) => void,
    getCurrentPeriod: () => PeriodDescription | null
) {
    let digitStack: string = "";

    document.getRootNode().addEventListener("keydown", (event: Event) => {
        if (!(event instanceof KeyboardEvent)) {
            return;
        }

        const currentPeriod = getCurrentPeriod();

        if (!currentPeriod) {
            return;
        }

        switch (event.key) {
            case "h":
            case "ArrowLeft":
                periodSelected(currentPeriod.previous());
                break;
            case "l":
            case "ArrowRight":
                if (!currentPeriod.next().isInFuture()) {
                    periodSelected(currentPeriod.next());
                }
                break;
            case "k":
            case "u":
            case "ArrowUp":
                if (!(currentPeriod instanceof YearDescription)) {
                    const up = currentPeriod.up();

                    if (!!up) {
                        periodSelected(up);
                    }
                }
                break;
            case "t":
            case "T":
                periodSelected(DayDescription.today());
                break;

            case "Enter":
                handleEnter();
                break;
        }

        if (event.key >= "0" && event.key <= "9") {
            handleDigit(event.key);
        }
    });

    function handleDigit(digit: string) {
        digitStack += digit;
    }

    function handleEnter() {
        const number = parseInt(digitStack);

        digitStack = "";

        if (!!number) {
            const periodDescription = getCurrentPeriod()?.atIndex(number);

            if (!periodDescription) {
                return;
            }

            periodSelected(periodDescription);
        }
    }
}
