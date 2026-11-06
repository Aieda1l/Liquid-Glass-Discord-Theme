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

