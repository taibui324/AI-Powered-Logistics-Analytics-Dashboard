import {
  ChartSpec,
  DashboardFilters,
  DashboardSummary,
  Explainability,
  LogisticsOrder
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(value: string) {
  return value.slice(0, 10);
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function weekKey(value: string) {
  const date = new Date(`${dateKey(value)}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function byCount<T extends string>(rows: LogisticsOrder[], key: (row: LogisticsOrder) => T) {
  const map = new Map<T, number>();
  rows.forEach((row) => map.set(key(row), (map.get(key(row)) ?? 0) + 1));
  return [...map.entries()].map(([name, orders]) => ({ name, orders }));
}

export function applyFilters(rows: LogisticsOrder[], filters: DashboardFilters) {
  return rows.filter((row) => {
    if (filters.from && row.orderDate < filters.from) return false;
    if (filters.to && row.orderDate > filters.to) return false;
    if (filters.carrier && row.carrier !== filters.carrier) return false;
    if (filters.region && row.region !== filters.region) return false;
    if (filters.warehouse && row.warehouse !== filters.warehouse) return false;
    if (filters.productCategory && row.productCategory !== filters.productCategory) return false;
    if (filters.sku && row.sku !== filters.sku) return false;
    return true;
  });
}

export function getFacets(rows: LogisticsOrder[]) {
  const values = (field: keyof LogisticsOrder) => [...new Set(rows.map((row) => String(row[field])))].sort();
  return {
    carrier: values("carrier"),
    region: values("region"),
    warehouse: values("warehouse"),
    productCategory: values("productCategory")
  };
}

export function summarizeDashboard(rows: LogisticsOrder[], filters: DashboardFilters = {}): DashboardSummary {
  const filtered = applyFilters(rows, filters);
  const deliveredOrders = filtered.filter((row) => row.status === "delivered").length;
  const delayedOrders = filtered.filter((row) => row.status === "delayed").length;
  const performanceDenominator = deliveredOrders + delayedOrders;
  const deliveredDurations = filtered
    .filter((row) => (row.status === "delivered" || row.status === "delayed") && row.deliveryDate)
    .map((row) => daysBetween(row.orderDate, row.deliveryDate as string));
  const revenue = filtered.reduce((sum, row) => sum + row.orderValueUsd, 0);

  const volumeData = [...filtered.reduce((map, row) => {
    const key = monthKey(row.orderDate);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>())]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, orders]) => ({ month, orders }));

  const statusSplit = byCount(filtered, (row) => row.status);

  const carrierDelayRate = [...new Set(filtered.map((row) => row.carrier))].sort().map((carrier) => {
    const carrierRows = filtered.filter((row) => row.carrier === carrier);
    const completed = carrierRows.filter((row) => row.status === "delivered" || row.status === "delayed");
    const delayed = completed.filter((row) => row.status === "delayed").length;
    return {
      carrier,
      orders: carrierRows.length,
      completedOrders: completed.length,
      delayedOrders: delayed,
      delayRate: completed.length ? round((delayed / completed.length) * 100, 1) : 0
    };
  });

  const regionBreakdown = [...filtered.reduce((map, row) => {
    const current = map.get(row.region) ?? { region: row.region, orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += row.orderValueUsd;
    map.set(row.region, current);
    return map;
  }, new Map<string, { region: string; orders: number; revenue: number }>()).values()]
    .sort((a, b) => b.orders - a.orders)
    .map((row) => ({ ...row, revenue: round(row.revenue, 0) }));

  const charts = {
    orderVolume: {
      type: "line",
      title: "Order volume over time",
      xKey: "month",
      yKey: "orders",
      data: volumeData
    } satisfies ChartSpec,
    statusSplit: {
      type: "pie",
      title: "Delivery status split",
      xKey: "name",
      yKey: "orders",
      data: statusSplit
    } satisfies ChartSpec,
    carrierDelayRate: {
      type: "bar",
      title: "Carrier delay rate",
      xKey: "carrier",
      yKey: "delayRate",
      data: carrierDelayRate
    } satisfies ChartSpec,
    regionBreakdown: {
      type: "bar",
      title: "Region breakdown",
      xKey: "region",
      yKey: "orders",
      data: regionBreakdown
    } satisfies ChartSpec
  };

  const explainability: Explainability = {
    filters,
    metrics: ["orders", "delivered_orders", "delayed_orders", "on_time_rate", "average_delivery_days"],
    dimensions: ["order_date", "status", "carrier", "region", "warehouse", "product_category"],
    timeGrain: "month",
    interpretation: "Dashboard summary over the filtered logistics orders.",
    queryPlan: ["Load read-only logistics dataset", "Apply dashboard filters", "Aggregate KPIs and chart series"],
    methodology: "On-time rate is delivered / (delivered + delayed). In-transit, exception, and canceled orders stay in total orders but do not enter the on-time denominator.",
    sourceRows: filtered.length
  };

  return {
    kpis: {
      totalOrders: filtered.length,
      deliveredOrders,
      delayedOrders,
      onTimeRate: performanceDenominator ? round((deliveredOrders / performanceDenominator) * 100, 1) : 0,
      averageDeliveryDays: deliveredDurations.length
        ? round(deliveredDurations.reduce((sum, days) => sum + days, 0) / deliveredDurations.length, 1)
        : 0,
      revenue: round(revenue, 0)
    },
    filters,
    facets: getFacets(rows),
    charts,
    tablePreview: filtered.slice(0, 12),
    explainability
  };
}

export function delayedByWeek(rows: LogisticsOrder[], filters: DashboardFilters = {}) {
  const filtered = applyFilters(rows, filters).filter((row) => row.status === "delayed");
  return [...filtered.reduce((map, row) => {
    const key = weekKey(row.orderDate);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>())]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, delayedOrders]) => ({ week, delayedOrders }));
}

export function carrierDelayRateRanking(rows: LogisticsOrder[], filters: DashboardFilters = {}) {
  const summary = summarizeDashboard(rows, filters);
  return [...summary.charts.carrierDelayRate.data].sort((a, b) => {
    const delayRateDiff = Number(b.delayRate) - Number(a.delayRate);
    if (delayRateDiff !== 0) return delayRateDiff;
    const delayedDiff = Number(b.delayedOrders ?? 0) - Number(a.delayedOrders ?? 0);
    if (delayedDiff !== 0) return delayedDiff;
    return String(a.carrier).localeCompare(String(b.carrier));
  });
}

export function highestCarrierDelayRate(rows: LogisticsOrder[], filters: DashboardFilters = {}) {
  return carrierDelayRateRanking(rows, filters)[0];
}

export function latestOrderDate(rows: LogisticsOrder[]) {
  return rows.reduce((max, row) => (row.orderDate > max ? row.orderDate : max), rows[0]?.orderDate ?? "");
}

export function lastMonthRange(rows: LogisticsOrder[]) {
  const latest = latestOrderDate(rows);
  const latestMonth = new Date(`${latest.slice(0, 7)}-01T00:00:00Z`);
  latestMonth.setUTCMonth(latestMonth.getUTCMonth() - 1);
  const from = latestMonth.toISOString().slice(0, 7) + "-01";
  latestMonth.setUTCMonth(latestMonth.getUTCMonth() + 1);
  latestMonth.setUTCDate(0);
  const to = latestMonth.toISOString().slice(0, 10);
  return { from, to };
}
