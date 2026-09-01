export type ChartType = "bar" | "line" | "pie" | "scatter";

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartSeries {
  name: string;
  data: ChartPoint[];
}

export interface ChartSpec {
  chart_type: ChartType;
  title: string;
  x_label: string;
  y_label: string;
  series: ChartSeries[];
}

const CHART_TYPES: ChartType[] = ["bar", "line", "pie", "scatter"];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidPoint(value: unknown): value is ChartPoint {
  if (typeof value !== "object" || value === null) return false;
  const point = value as Record<string, unknown>;
  return isFiniteNumber(point.x) && isFiniteNumber(point.y);
}

function isValidSeries(value: unknown): value is ChartSeries {
  if (typeof value !== "object" || value === null) return false;
  const series = value as Record<string, unknown>;
  return (
    isNonEmptyString(series.name) &&
    Array.isArray(series.data) &&
    series.data.length > 0 &&
    series.data.every(isValidPoint)
  );
}

// Strict validation: a malformed chart_spec must be dropped, never crash
// quiz generation or reach the renderer. Returns null on any violation.
export function validateChartSpec(value: unknown): ChartSpec | null {
  if (typeof value !== "object" || value === null) return null;
  const spec = value as Record<string, unknown>;

  if (!CHART_TYPES.includes(spec.chart_type as ChartType)) return null;
  if (!isNonEmptyString(spec.title)) return null;
  if (!isNonEmptyString(spec.x_label)) return null;
  if (!isNonEmptyString(spec.y_label)) return null;
  if (!Array.isArray(spec.series) || spec.series.length === 0) return null;
  if (!spec.series.every(isValidSeries)) return null;

  return {
    chart_type: spec.chart_type as ChartType,
    title: spec.title as string,
    x_label: spec.x_label as string,
    y_label: spec.y_label as string,
    series: spec.series as ChartSeries[],
  };
}
