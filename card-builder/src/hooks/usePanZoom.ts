"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";

type PanZoomOptions = {
  minScale?: number;
  maxScale?: number;
};

type Point = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function distance(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function usePanZoom({ minScale = 0.5, maxScale = 3 }: PanZoomOptions = {}) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState<Point>({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, Point>());
  const lastPan = useRef<Point | null>(null);
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      lastPan.current = { x: event.clientX, y: event.clientY };
    } else if (pointers.current.size === 2) {
      const values = Array.from(pointers.current.values());
      pinchStart.current = {
        distance: distance(values[0], values[1]),
        scale,
      };
    }
  }, [scale]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1 && lastPan.current) {
      const dx = event.clientX - lastPan.current.x;
      const dy = event.clientY - lastPan.current.y;
      setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPan.current = { x: event.clientX, y: event.clientY };
    } else if (pointers.current.size === 2 && pinchStart.current) {
      const values = Array.from(pointers.current.values());
      const nextDistance = distance(values[0], values[1]);
      const nextScale = clamp(
        pinchStart.current.scale * (nextDistance / pinchStart.current.distance),
        minScale,
        maxScale,
      );
      setScale(nextScale);
    }
  }, [maxScale, minScale]);

  const onPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      pinchStart.current = null;
    }
    if (pointers.current.size === 0) {
      lastPan.current = null;
    } else if (pointers.current.size === 1) {
      const value = Array.from(pointers.current.values())[0];
      lastPan.current = value ?? null;
    }
  }, []);

  const onWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = -event.deltaY;
    setScale((prev) => clamp(prev + delta * 0.0015, minScale, maxScale));
  }, [maxScale, minScale]);

  const reset = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const transform = useMemo(
    () => ({
      transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
      transformOrigin: "0 0",
    }),
    [scale, translate.x, translate.y],
  );

  const handlers = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onWheel,
    }),
    [onPointerDown, onPointerMove, onPointerUp, onWheel],
  );

  return { transformStyle: transform, handlers, reset, scale, translate };
}
