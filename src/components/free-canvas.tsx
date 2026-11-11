import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fitView, pointToImage, zoomAt, type View } from "@/lib/qingyan/canvas-math";
import type { FrameRegion } from "@/lib/qingyan/frame";
import { playSfx } from "@/lib/qingyan/sfx";

export interface CanvasImage {
  src: string;
  alt: string;
  credit?: string;
}

export function FreeCanvas({
  images,
  index,
  onIndex,
  onClose,
  pick,
  mark,
  regions,
}: {
  images: CanvasImage[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  /** When set, a tap in 点选 mode reports a normalized point and does not close. */
  pick?: ((x: number, y: number) => void) | null;
  mark?: { x: number; y: number } | null;
  regions?: FrameRegion[];
}) {
  const image = images[index];
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const viewRef = useRef<View>({ tx: 0, ty: 0, scale: 1 });
  const labelRef = useRef<HTMLSpanElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: "pan"; id: number; sx: number; sy: number; tx: number; ty: number; moved: boolean }
    | { kind: "pinch"; dist: number; scale: number; mx: number; my: number; tx: number; ty: number }
    | null
  >(null);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const [mode, setMode] = useState<"pan" | "pick">(pick ? "pan" : "pan");
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const modeRef = useRef(mode);
  modeRef.current = mode;

  function paint(view: View) {
    viewRef.current = view;
    const layer = layerRef.current;
    if (layer) layer.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`;
    if (labelRef.current) labelRef.current.textContent = `${Math.round(view.scale * 100)}%`;
  }

  function fit() {
    const viewport = viewportRef.current;
    const img = imgRef.current;
    if (!viewport || !img || !img.naturalWidth) return;
    setNat({ w: img.naturalWidth, h: img.naturalHeight });
    paint(fitView(img.naturalWidth, img.naturalHeight, viewport.clientWidth, viewport.clientHeight));
  }

  useLayoutEffect(() => {
    paint(viewRef.current);
    if (imgRef.current?.complete && imgRef.current.naturalWidth) fit();
  }, [image?.src]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const stop = (event: Event) => event.preventDefault();
    viewport.addEventListener("wheel", onWheel, { passive: false });
    viewport.addEventListener("touchmove", stop, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("touchmove", stop);
    };
    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = viewport!.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0016);
      paint(zoomAt(viewRef.current, event.clientX - rect.left, event.clientY - rect.top, factor));
    }
  }, [image?.src]);

  const closeRef = useRef(onClose);
  const indexRef = useRef(onIndex);
  closeRef.current = onClose;
  indexRef.current = onIndex;

  useEffect(() => {
    document.body.dataset.canvas = "1";
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        nudge(1.2);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        nudge(1 / 1.2);
      } else if (event.key === "0") {
        event.preventDefault();
        fit();
      } else if (event.key === "ArrowRight" && images.length > 1) {
        event.preventDefault();
        indexRef.current((index + 1) % images.length);
      } else if (event.key === "ArrowLeft" && images.length > 1) {
        event.preventDefault();
        indexRef.current((index - 1 + images.length) % images.length);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      delete document.body.dataset.canvas;
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [images.length, index]);

  function nudge(factor: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    paint(zoomAt(viewRef.current, viewport.clientWidth / 2, viewport.clientHeight / 2, factor));
  }

  function local(clientX: number, clientY: number) {
    const rect = viewportRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function syncGesture() {
    const entries = [...pointers.current.entries()];
    const view = viewRef.current;
    if (entries.length >= 2) {
      const a = local(entries[0]![1].x, entries[0]![1].y);
      const b = local(entries[1]![1].x, entries[1]![1].y);
      gesture.current = {
        kind: "pinch",
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        scale: view.scale,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        tx: view.tx,
        ty: view.ty,
      };
      return;
    }
    if (entries.length === 1) {
      const point = local(entries[0]![1].x, entries[0]![1].y);
      gesture.current = { kind: "pan", id: entries[0]![0], sx: point.x, sy: point.y, tx: view.tx, ty: view.ty, moved: false };
      return;
    }
    gesture.current = null;
  }

  function handleTap(x: number, y: number) {
    const now = performance.now();
    const last = lastTap.current;
    const double = now - last.t < 280 && Math.hypot(x - last.x, y - last.y) < 24;
    lastTap.current = { t: now, x, y };
    if (double) {
      const fitted = imgRef.current && viewportRef.current
        ? fitView(imgRef.current.naturalWidth, imgRef.current.naturalHeight, viewportRef.current.clientWidth, viewportRef.current.clientHeight)
        : null;
      if (fitted && viewRef.current.scale > fitted.scale * 1.4) paint(fitted);
      else paint(zoomAt(viewRef.current, x, y, 2));
      return;
    }
    if (pick && modeRef.current === "pick" && imgRef.current) {
      const point = pointToImage(viewRef.current, x, y, imgRef.current.naturalWidth, imgRef.current.naturalHeight);
      if (point) pick(point.x, point.y);
    }
  }

  if (!image || typeof document === "undefined") return null;

  return createPortal(
    <div className="free-canvas" role="dialog" aria-modal="true" aria-label="查看附图">
      <div
        ref={viewportRef}
        className="free-canvas-stage"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("[data-canvas-ui]")) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          syncGesture();
        }}
        onPointerMove={(event) => {
          if (!pointers.current.has(event.pointerId)) return;
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          const current = gesture.current;
          if (!current || !viewportRef.current) return;
          if (current.kind === "pinch" && pointers.current.size >= 2) {
            const pts = [...pointers.current.values()];
            const a = local(pts[0]!.x, pts[0]!.y);
            const b = local(pts[1]!.x, pts[1]!.y);
            const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const worldX = (current.mx - current.tx) / current.scale;
            const worldY = (current.my - current.ty) / current.scale;
            const scale = Math.min(16, Math.max(0.08, current.scale * (dist / current.dist)));
            paint({ scale, tx: mx - worldX * scale, ty: my - worldY * scale });
            return;
          }
          if (current.kind === "pan" && event.pointerId === current.id) {
            const point = local(event.clientX, event.clientY);
            const dx = point.x - current.sx;
            const dy = point.y - current.sy;
            if (Math.hypot(dx, dy) > 3) current.moved = true;
            paint({ tx: current.tx + dx, ty: current.ty + dy, scale: viewRef.current.scale });
          }
        }}
        onPointerUp={(event) => {
          const current = gesture.current;
          const tap = current?.kind === "pan" && current.id === event.pointerId && !current.moved;
          pointers.current.delete(event.pointerId);
          if (tap) {
            const point = local(event.clientX, event.clientY);
            handleTap(point.x, point.y);
          }
          syncGesture();
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          syncGesture();
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div ref={layerRef} className="free-canvas-layer">
          <img
            ref={imgRef}
            src={image.src}
            alt={image.alt}
            draggable={false}
            onLoad={fit}
          />
          {nat.w > 0 ? (
            <svg className="free-canvas-marks" viewBox={`0 0 ${nat.w} ${nat.h}`} width={nat.w} height={nat.h}>
              {regions?.map((region) => (
                <ellipse
                  key={region.id}
                  cx={region.x * nat.w}
                  cy={region.y * nat.h}
                  rx={region.r * nat.w}
                  ry={region.r * nat.h}
                  className="mark-region"
                />
              ))}
              {mark ? <circle cx={mark.x * nat.w} cy={mark.y * nat.h} r={Math.min(nat.w, nat.h) * 0.012} className="mark-you" /> : null}
            </svg>
          ) : null}
        </div>
      </div>
      <div className="free-canvas-bar" data-canvas-ui>
        <button type="button" data-canvas-ui className="canvas-icon" onClick={() => { playSfx("close"); onClose(); }} aria-label="关闭">
          <img src="/cc/icons/cross-mark.svg" alt="" />
        </button>
        <button type="button" data-canvas-ui className="canvas-icon" onClick={() => nudge(1 / 1.2)} aria-label="缩小">
          <img src="/cc/icons/magnifying-glass.svg" alt="" />
        </button>
        <span ref={labelRef} className="canvas-label">100%</span>
        <button type="button" data-canvas-ui className="canvas-icon" onClick={() => nudge(1.2)} aria-label="放大">
          <img src="/cc/icons/magnifying-glass.svg" alt="" />
        </button>
        <button type="button" data-canvas-ui className="canvas-icon" onClick={fit} aria-label="回到整张图">
          <img src="/cc/icons/cycle.svg" alt="" />
        </button>
        {images.length > 1 ? (
          <>
            <button type="button" data-canvas-ui className="canvas-icon" onClick={() => onIndex((index - 1 + images.length) % images.length)} aria-label="上一张">
              <img src="/cc/icons/previous-button.svg" alt="" />
            </button>
            <button type="button" data-canvas-ui className="canvas-icon" onClick={() => onIndex((index + 1) % images.length)} aria-label="下一张">
              <img src="/cc/icons/fast-forward-button.svg" alt="" />
            </button>
          </>
        ) : null}
        {pick ? (
          <div className="canvas-mode" data-canvas-ui>
            <button type="button" data-canvas-ui className={mode === "pan" ? "is-on" : ""} onClick={() => setMode("pan")}>拖动</button>
            <button type="button" data-canvas-ui className={mode === "pick" ? "is-on" : ""} onClick={() => setMode("pick")}>点选</button>
          </div>
        ) : null}
      </div>
      <p className="free-canvas-note" data-canvas-ui>
        附图。滚轮或捏合可缩放，拖动不受边缘限制。关闭用右上角或 Esc。
        {image.credit ? ` ${image.credit}` : ""}
      </p>
    </div>,
    document.body,
  );
}
