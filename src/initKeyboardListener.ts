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

        if (event.key >= "0" && event.key <= "9") {
            handleDigit(event.key);
            return;
        }

        let newPeriod: PeriodDescription | null = null;

        switch (event.key) {
            case "h":
            case "ArrowLeft":
                newPeriod = currentPeriod.previous();
                break;
            case "l":
            case "ArrowRight":
                if (!currentPeriod.next().isInFuture()) {
                    newPeriod = currentPeriod.next();
                }
                break;
            case "k":
            case "u":
            case "ArrowUp":
                if (!(currentPeriod instanceof YearDescription)) {
                    newPeriod = currentPeriod.up();
                }
                break;
            case "t":
            case "T":
                newPeriod = DayDescription.today();
                break;

            case "Enter":
                newPeriod = handleEnter();
                break;
            default:
                return;
        }

        if (newPeriod?.isValid()) {
            periodSelected(newPeriod);
        }
    });

    function handleDigit(digit: string) {
        digitStack += digit;
    }

    function handleEnter(): PeriodDescription | null {
        const number = parseInt(digitStack);

        digitStack = "";

        if (!!number) {
            const periodDescription = getCurrentPeriod()?.atIndex(number);

            if (periodDescription) {
                return periodDescription;
            }
        }

        return null;
    }
}
