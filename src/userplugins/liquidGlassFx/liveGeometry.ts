/** Geometry for the experimental live channel overlay. No Discord DOM or GPU dependencies. */
export interface Bounds { left: number; top: number; width: number; height: number; }

export function selectionInViewport(row: Bounds, viewport: Bounds): boolean {
    if (![row.left, row.top, row.width, row.height, viewport.left, viewport.top, viewport.width, viewport.height]
        .every(Number.isFinite) || row.width <= 0 || row.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return false;
    // Require most of a row to be visible; hiding avoids painting over cut-off labels.
    const left = Math.max(row.left, viewport.left);
    const top = Math.max(row.top, viewport.top);
    const right = Math.min(row.left + row.width, viewport.left + viewport.width);
    const bottom = Math.min(row.top + row.height, viewport.top + viewport.height);
    return right > left && bottom - top >= row.height * 0.4;
}

/** Only a scroll within the channel-list viewport should snap its liquid indicator.
 * Capturing scroll at the document level also sees chat/message scrolling. */
export function scrollAffectsViewport(
    viewport: (EventTarget & { contains(node: Node): boolean; }) | null,
    target: EventTarget | null
): boolean {
    return !!viewport && !!target && (target === viewport ||
        ("nodeType" in target && viewport.contains(target as Node)));
}

/**
 * Live-channel motion is vertical. Keep the trailing meniscus close to the
 * moving selection, even when the old channel is many rows away. Rendering
 * a second channel-width pill at tailY creates detached ghost capsules.
 */
export function compactLiveTrail(
    selection: { x: number; y: number; width: number; height: number; },
    headY: number,
    tailY: number
): { x: number; y: number; width: number; height: number; } {
    const width = Math.max(0, Math.min(42, selection.width * 0.10));
    const height = Math.max(0, Math.min(10, selection.height * 0.23));
    const maxOffset = Math.max(0, selection.height * 0.55);
    const dy = Math.max(-maxOffset, Math.min(maxOffset, tailY - headY));
    return {
        x: selection.x + (selection.width - width) * 0.5,
        y: headY + dy - height * 0.5,
        width,
        height
    };
}
