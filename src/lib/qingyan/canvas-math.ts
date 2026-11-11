export interface View {
  tx: number;
  ty: number;
  scale: number;
}

export const SCALE_MIN = 0.08;
export const SCALE_MAX = 16;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale));
}

/** Zoom around a viewport point. That point stays put on screen. */
export function zoomAt(view: View, px: number, py: number, factor: number): View {
  const scale = clampScale(view.scale * factor);
  const worldX = (px - view.tx) / view.scale;
  const worldY = (py - view.ty) / view.scale;
  return { scale, tx: px - worldX * scale, ty: py - worldY * scale };
}

export function fitView(imgW: number, imgH: number, viewW: number, viewH: number, pad = 0.9): View {
  if (imgW <= 0 || imgH <= 0 || viewW <= 0 || viewH <= 0) return { tx: 0, ty: 0, scale: 1 };
  const scale = clampScale(Math.min(viewW / imgW, viewH / imgH) * pad);
  return {
    scale,
    tx: (viewW - imgW * scale) / 2,
    ty: (viewH - imgH * scale) / 2,
  };
}

/** Pan is never clamped. A caller can place any image edge on the viewport center. */
export function panBy(view: View, dx: number, dy: number): View {
  return { tx: view.tx + dx, ty: view.ty + dy, scale: view.scale };
}

export function pointToImage(
  view: View,
  px: number,
  py: number,
  imgW: number,
  imgH: number,
): { x: number; y: number } | null {
  if (imgW <= 0 || imgH <= 0 || view.scale === 0) return null;
  const x = (px - view.tx) / view.scale / imgW;
  const y = (py - view.ty) / view.scale / imgH;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}
