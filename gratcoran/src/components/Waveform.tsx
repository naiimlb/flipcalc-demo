"use client";

import { useEffect, useRef } from "react";

const BARS = 36;

/** Onde en direct à partir de l'AnalyserNode (barres symétriques). */
export function Waveform({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const data = new Uint8Array(analyser?.fftSize ?? 1024);
    const levels = new Float32Array(BARS);
    let raf = 0;
    let t = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, "#10b981");
      gradient.addColorStop(1, "#2563eb");
      ctx.fillStyle = gradient;

      if (analyser && active) {
        analyser.getByteTimeDomainData(data);
        const step = Math.floor(data.length / BARS);
        for (let i = 0; i < BARS; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            const v = (data[i * step + j] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / step);
          const target = Math.min(1, rms * 4.5);
          levels[i] += (target - levels[i]) * 0.35;
        }
      } else {
        t += 0.03;
        for (let i = 0; i < BARS; i++) {
          const target = 0.06 + 0.04 * Math.sin(t + i * 0.45);
          levels[i] += (target - levels[i]) * 0.12;
        }
      }

      const gap = w / BARS;
      const barW = gap * 0.55;
      for (let i = 0; i < BARS; i++) {
        // Enveloppe : plus haut au centre.
        const env = 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / BARS);
        const bh = Math.max(barW, levels[i] * env * h);
        const x = i * gap + (gap - barW) / 2;
        const y = (h - bh) / 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, barW, bh, barW / 2);
        else ctx.rect(x, y, barW, bh);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [analyser, active]);

  return <canvas ref={canvasRef} aria-hidden className="h-16 w-full max-w-xs" />;
}
