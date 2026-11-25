// The "Bottom Nav Bar" vector from Figma (385×55), rebuilt so it can be any width:
// the left edge stays put, the notch stays centred, and the right edge follows the width.
// Coordinates are copied verbatim from the exported SVG; only the x offsets are parametric.

const NOTCH_HALF = 192.5;

function notch(cx: number) {
  const o = cx - NOTCH_HALF;
  const x = (v: number) => (v + o).toFixed(3);
  return (
    `H${x(130)}` +
    `C${x(143.255)} 0 ${x(153.492)} 11.7206 ${x(161.238)} 22.4762` +
    `C${x(168.228)} 32.1813 ${x(179.626)} 38.5 ${x(192.5)} 38.5` +
    `C${x(205.374)} 38.5 ${x(216.772)} 32.1813 ${x(223.762)} 22.4762` +
    `C${x(231.508)} 11.7206 ${x(241.745)} 0 ${x(255)} 0`
  );
}

/** Nav bar with all four corners rounded and the notch at the top centre. */
export function navBarPath(w: number) {
  return (
    `M${w - 24} 0C${w - 10.745} 0 ${w} 10.7452 ${w} 24V31C${w} 44.2548 ${w - 10.745} 55 ${w - 24} 55` +
    `H24C10.7452 55 0 44.2548 0 31V24C0 10.7452 10.7452 0 24 0` +
    notch(w / 2) +
    `H${w - 24}Z`
  );
}

/**
 * Bottom of the "Add Task" card: the same shape with square bottom corners,
 * drawn rotated 180° so the notch opens downward around the + button.
 */
export function sheetNotchPath(w: number) {
  return (
    `M${w - 24} 0C${w - 10.745} 0 ${w} 10.7452 ${w} 24V55H0V24C0 10.7452 10.7452 0 24 0` +
    notch(w / 2) +
    `H${w - 24}Z`
  );
}

export const NAV_SHAPE_HEIGHT = 55;
