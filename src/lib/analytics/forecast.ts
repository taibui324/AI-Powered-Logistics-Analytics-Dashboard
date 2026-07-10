import { ChartSpec, DashboardFilters, Explainability, LogisticsOrder } from "./types";
import { applyFilters, latestOrderDate } from "./dashboard";

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function addMonth(month: string, offset: number) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`Invalid month value: ${month}`);
  }
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function forecastDemand(rows: LogisticsOrder[], filters: DashboardFilters = {}, months = 4) {
  const filtered = applyFilters(rows, filters);
  const monthly = [...filtered.reduce((map, row) => {
    const key = row.orderDate.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + row.quantity);
    return map;
  }, new Map<string, number>())]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, quantity]) => ({ month, quantity }));

  const recent = monthly.slice(-3);
  const baseline = recent.length ? recent.reduce((sum, row) => sum + row.quantity, 0) / recent.length : 0;
  const trend = recent.length >= 2 ? (recent[recent.length - 1].quantity - recent[0].quantity) / (recent.length - 1) : 0;
  const sourceRows = filtered.length ? filtered : rows;
  const lastMonth = monthly[monthly.length - 1]?.month ?? latestOrderDate(sourceRows).slice(0, 7);
  const forecast = lastMonth ? Array.from({ length: months }, (_, index) => ({
    month: addMonth(lastMonth, index + 1),
    quantity: Math.max(0, round(baseline + trend * (index + 1)))
  })) : [];
  const averageForecast = forecast.length ? round(forecast.reduce((sum, row) => sum + row.quantity, 0) / forecast.length) : 0;

  const chart: ChartSpec = {
    type: "line",
    title: "Monthly demand forecast",
    xKey: "month",
    yKey: "quantity",
    colorKey: "series",
    data: [
      ...monthly.map((row) => ({ ...row, series: "actual" })),
      ...forecast.map((row) => ({ ...row, series: "forecast" }))
    ]
  };

  const explainability: Explainability = {
    filters,
    metrics: ["quantity"],
    dimensions: ["order_date_month"],
    timeGrain: "month",
    interpretation: filters.sku
      ? `Forecast demand for SKU ${filters.sku}.`
      : filters.productCategory
        ? `Forecast demand for product category ${filters.productCategory}.`
        : filters.warehouse
          ? `Forecast demand for warehouse ${filters.warehouse}.`
          : "Forecast total demand.",
    queryPlan: ["Filter rows", "Aggregate monthly quantity", "Project next months from three-month moving average plus simple trend"],
    methodology: "Forecast uses the last three monthly quantity totals as a moving-average baseline and adds the recent linear trend. This is deterministic and explainable for reviewer use.",
    sourceRows: filtered.length
  };

  return {
    history: monthly,
    forecast,
    chart,
    explainability,
    recommendation: `Plan around ${averageForecast.toLocaleString()} units per month, then add a safety buffer for promotions or exception-heavy lanes.`
  };
}
