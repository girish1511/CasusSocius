import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { ChartSpec, ChartSeries } from "./chart-spec";

// @napi-rs/canvas ships prebuilt native binaries per platform (Rust/napi-rs,
// no system Cairo/Pango — unlike `canvas`/node-canvas, which needs those
// installed via apt and is a common source of broken Railway/Docker builds).
// Residual risk: prebuilt binaries only cover common targets (linux-x64-gnu,
// linux-arm64-gnu, musl, darwin, win32); if Railway's build image ever moves
// off one of those (e.g. an unusual musl/arm combination), npm install would
// fall back to a source build requiring Rust toolchain. Worth a smoke test
// after first deploy, but this is a much smaller risk than node-canvas.

const WIDTH = 900;
const HEIGHT = 560;
const PADDING = { top: 56, right: 32, bottom: 64, left: 72 };

// Minimal, printable-friendly palette — distinct enough in grayscale via
// varying shades, not just hue.
const SERIES_COLORS = ["#1f2937", "#d97757", "#2563eb", "#059669", "#7c3aed"];

export async function renderChartPng(spec: ChartSpec): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawTitle(ctx, spec.title);

  if (spec.chart_type === "pie") {
    drawPie(ctx, spec.series[0]);
  } else {
    drawCartesian(ctx, spec);
  }

  return canvas.toBuffer("image/png");
}

function drawTitle(ctx: SKRSContext2D, title: string) {
  ctx.fillStyle = "#111111";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(title, WIDTH / 2, 32);
}

function drawCartesian(ctx: SKRSContext2D, spec: ChartSpec) {
  const plotLeft = PADDING.left;
  const plotRight = WIDTH - PADDING.right;
  const plotTop = PADDING.top;
  const plotBottom = HEIGHT - PADDING.bottom;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  const allPoints = spec.series.flatMap((s) => s.data);
  const xMin = Math.min(...allPoints.map((p) => p.x));
  const xMax = Math.max(...allPoints.map((p) => p.x));
  const yMin = Math.min(0, ...allPoints.map((p) => p.y));
  const yMax = Math.max(...allPoints.map((p) => p.y));

  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const toPx = (x: number) => plotLeft + ((x - xMin) / xRange) * plotWidth;
  const toPy = (y: number) => plotBottom - ((y - yMin) / yRange) * plotHeight;

  // Axes
  ctx.strokeStyle = "#666666";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(plotLeft, plotTop);
  ctx.lineTo(plotLeft, plotBottom);
  ctx.lineTo(plotRight, plotBottom);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = "#333333";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(spec.x_label, (plotLeft + plotRight) / 2, HEIGHT - 20);

  ctx.save();
  ctx.translate(20, (plotTop + plotBottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText(spec.y_label, 0, 0);
  ctx.restore();

  // Tick labels (min/max on each axis, simple and legible)
  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#555555";
  ctx.textAlign = "left";
  ctx.fillText(yMax.toFixed(1), 6, plotTop + 4);
  ctx.fillText(yMin.toFixed(1), 6, plotBottom + 4);
  ctx.textAlign = "center";
  ctx.fillText(xMin.toFixed(1), plotLeft, plotBottom + 18);
  ctx.fillText(xMax.toFixed(1), plotRight, plotBottom + 18);

  spec.series.forEach((series, i) => {
    const color = SERIES_COLORS[i % SERIES_COLORS.length];
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    if (spec.chart_type === "line") {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      series.data
        .slice()
        .sort((a, b) => a.x - b.x)
        .forEach((p, idx) => {
          const px = toPx(p.x);
          const py = toPy(p.y);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
      ctx.stroke();
    } else if (spec.chart_type === "scatter") {
      for (const p of series.data) {
        ctx.beginPath();
        ctx.arc(toPx(p.x), toPy(p.y), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (spec.chart_type === "bar") {
      const seriesCount = spec.series.length;
      const groupWidth = plotWidth / series.data.length;
      const barWidth = (groupWidth * 0.6) / seriesCount;

      series.data.forEach((p, idx) => {
        const groupCenter = plotLeft + groupWidth * idx + groupWidth / 2;
        const barX = groupCenter - (seriesCount * barWidth) / 2 + i * barWidth;
        const barY = toPy(Math.max(0, p.y));
        const barHeight = Math.abs(toPy(0) - toPy(p.y));
        ctx.fillRect(barX, barY, barWidth, barHeight);
      });
    }
  });

  drawLegend(ctx, spec.series);
}

function drawPie(ctx: SKRSContext2D, series: ChartSeries) {
  const cx = WIDTH / 2;
  const cy = PADDING.top + (HEIGHT - PADDING.top - PADDING.bottom) / 2;
  const radius = Math.min(WIDTH, HEIGHT - PADDING.top - PADDING.bottom) / 2 - 40;

  const total = series.data.reduce((sum, p) => sum + Math.max(0, p.y), 0) || 1;
  let angle = -Math.PI / 2;

  series.data.forEach((point, i) => {
    const slice = (Math.max(0, point.y) / total) * Math.PI * 2;
    ctx.fillStyle = SERIES_COLORS[i % SERIES_COLORS.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + slice);
    ctx.closePath();
    ctx.fill();
    angle += slice;
  });

  // Legend: each slice's x-value as its label, since pie has no series list.
  ctx.font = "12px sans-serif";
  ctx.textAlign = "left";
  series.data.forEach((point, i) => {
    const legendY = HEIGHT - PADDING.bottom + 20 + i * 16;
    ctx.fillStyle = SERIES_COLORS[i % SERIES_COLORS.length];
    ctx.fillRect(PADDING.left, legendY - 10, 10, 10);
    ctx.fillStyle = "#333333";
    ctx.fillText(`${point.x}: ${point.y}`, PADDING.left + 16, legendY - 1);
  });
}

function drawLegend(ctx: SKRSContext2D, series: ChartSeries[]) {
  if (series.length <= 1) return;
  ctx.font = "12px sans-serif";
  ctx.textAlign = "left";
  series.forEach((s, i) => {
    const x = PADDING.left + i * 140;
    const y = PADDING.top - 18;
    ctx.fillStyle = SERIES_COLORS[i % SERIES_COLORS.length];
    ctx.fillRect(x, y - 9, 10, 10);
    ctx.fillStyle = "#333333";
    ctx.fillText(s.name, x + 14, y);
  });
}
