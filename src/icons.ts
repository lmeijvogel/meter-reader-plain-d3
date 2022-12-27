import { createIcons, ChevronLast, ChevronLeft, ChevronRight, ChevronUp, Loader2 } from "lucide";

/* Note: This replaces icons that are _currently_ in the DOM,
 * so only call this after all the elements are present.
 */
export function initIcons() {
    createIcons({
        icons: { ChevronLast, ChevronLeft, ChevronRight, ChevronUp, Loader2 }
    });
}
