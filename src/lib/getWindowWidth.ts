export function getWindowWidth() {
    const rects = document.body.getClientRects();
    return rects[0].width;
}
