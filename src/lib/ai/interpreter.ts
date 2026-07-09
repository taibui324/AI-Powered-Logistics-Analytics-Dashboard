import {
  carrierDelayRateRanking,
  delayedByWeek,
  lastMonthRange,
  latestOrderDate
} from "@/lib/analytics/dashboard";
import { forecastDemand } from "@/lib/analytics/forecast";
import { AnalystAnswer, DashboardFilters, Explainability, LogisticsOrder } from "@/lib/analytics/types";

const SUPPORTED_EXAMPLES = [
  "Show delayed orders by week for the last 3 months",
  "Which carrier has the highest delay rate?",
  "How many orders were delivered late last month?",
  "Predict demand for SKU CRAYON-0017 for the next 4 months"
];

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function lastThreeMonths(rows: LogisticsOrder[]): DashboardFilters {
  const latest = latestOrderDate(rows);
  const start = new Date(`${latest.slice(0, 7)}-01T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 2);
  return { from: start.toISOString().slice(0, 10), to: latest };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function withExplanation(answer: Omit<AnalystAnswer, "explanation">): AnalystAnswer {
  return { ...answer, explanation: answer.explainability };
}

function unsupported(question: string, reason: string): AnalystAnswer {
  const explainability: Explainability = {
    filters: {},
    metrics: [],
    dimensions: [],
    interpretation: "Unsupported question; no analytical tool was executed.",
    queryPlan: ["Parse the question", "Match it against the bounded deterministic toolset", "Reject unsupported intents instead of fabricating an answer"],
    methodology: "The interpreter is intentionally bounded so only supported queries are routed into deterministic analytics or forecasting tools.",
    sourceRows: 0
  };

  return withExplanation({
    mode: "deterministic",
    question,
    answer: `Unsupported query: ${reason}`,
    intent: { tool: "unsupported", metric: "unsupported", dimensions: [], chart: "table" },
    chart: {
      type: "table",
      title: "Supported questions",
      data: SUPPORTED_EXAMPLES.map((example) => ({ example }))
    },
    table: SUPPORTED_EXAMPLES.map((example) => ({ example })),
    explainability,
    recommendation: `Try one of these prompts: ${SUPPORTED_EXAMPLES.join(" | ")}`,
    unsupportedReason: reason
  });
}

function parseForecastRequest(question: string) {
  const monthMatch =
    question.match(/\b(?:next|for)\s+(\d+)\s+months?\b/i) ??
    question.match(/\b(\d+)\s+month\b/i);
  const months = clamp(Number(monthMatch?.[1] ?? 4), 1, 12);

  const skuMatch = question.match(/\bsku\s+([a-z0-9-]+)\b/i);
  if (skuMatch) {
    const sku = skuMatch[1].toUpperCase();
    return {
      months,
      filters: { sku },
      scopeLabel: `SKU ${sku}`
    };
  }

  const categoryMatch = question.match(/\b(?:product\s+category|category)\s+([a-z0-9-]+)\b/i);
  if (categoryMatch) {
    const productCategory = categoryMatch[1].toUpperCase();
    return {
      months,
      filters: { productCategory },
      scopeLabel: `product category ${productCategory}`
    };
  }

  const warehouseMatch = question.match(/\bwarehouse\s+([a-z0-9-]+)\b/i);
  if (warehouseMatch) {
    const warehouse = warehouseMatch[1].toUpperCase();
    return {
      months,
      filters: { warehouse },
      scopeLabel: `warehouse ${warehouse}`
    };
  }

  return {
    months,
    filters: {},
    scopeLabel: "total"
  };
}

export function answerQuestion(rows: LogisticsOrder[], question: string): AnalystAnswer {
  const text = normalize(question);

  if (text.includes("forecast") || text.includes("predict") || text.includes("plan")) {
    const request = parseForecastRequest(question);
    const forecast = forecastDemand(rows, request.filters, request.months);

    if (forecast.history.length === 0) {
      return unsupported(question, `No historical demand was found for ${request.scopeLabel} demand.`);
    }

    if (forecast.history.length < 2) {
      return unsupported(
        question,
        `Not enough monthly history was found for ${request.scopeLabel} demand. Try total demand, a warehouse, or a product category with more history.`
      );
    }

    return withExplanation({
      mode: "deterministic",
      question,
      answer: `Forecasted ${request.scopeLabel} demand for the next ${request.months} months using monthly quantity history, a three-month moving average baseline, and a simple trend adjustment.`,
      intent: { tool: "forecast", metric: "demand", dimensions: ["month"], chart: "line" },
      chart: {
        ...forecast.chart,
        title: `Monthly demand forecast for ${request.scopeLabel}`
      },
      table: [
        ...forecast.history.map((row) => ({ ...row, series: "actual" })),
        ...forecast.forecast.map((row) => ({ ...row, series: "forecast" }))
      ],
      explainability: {
        ...forecast.explainability,
        filters: request.filters,
        interpretation: `Forecast ${request.scopeLabel} demand over ${request.months} future months.`,
        queryPlan: [
          "Interpret the forecast scope and horizon from the question",
          ...forecast.explainability.queryPlan
        ]
      },
      recommendation: forecast.recommendation
    });
  }

  if (text.includes("highest") && text.includes("carrier") && text.includes("delay")) {
    const ranked = carrierDelayRateRanking(rows);
    const top = ranked[0];
    const explainability: Explainability = {
      filters: {},
      metrics: ["delay_rate", "completed_orders", "delayed_orders"],
      dimensions: ["carrier"],
      interpretation: "Rank carriers by delayed divided by delivered-plus-delayed orders.",
      queryPlan: ["Group completed orders by carrier", "Calculate delayed / (delivered + delayed)", "Sort descending and return the ranking"],
      methodology: "Delay rate excludes in-transit, exception, and canceled orders from the denominator.",
      sourceRows: rows.length
    };

    return withExplanation({
      mode: "deterministic",
      question,
      answer: `${top.carrier} has the highest completed-order delay rate at ${top.delayRate}% (${top.delayedOrders} delayed of ${top.completedOrders} completed orders).`,
      intent: { tool: "analytics_query", metric: "delay_rate", dimensions: ["carrier"], chart: "bar" },
      chart: {
        type: "bar",
        title: "Ranked carrier delay rate",
        xKey: "carrier",
        yKey: "delayRate",
        data: ranked
      },
      table: ranked,
      explainability
    });
  }

  if (text.includes("late last month") || (text.includes("delivered late") && text.includes("last month"))) {
    const filters = lastMonthRange(rows);
    const delayed = rows.filter(
      (row) =>
        row.status === "delayed" &&
        row.deliveryDate &&
        row.deliveryDate >= filters.from &&
        row.deliveryDate <= filters.to
    );
    const explainability: Explainability = {
      filters,
      metrics: ["delayed_orders"],
      dimensions: ["delivery_date", "status"],
      timeGrain: "month",
      interpretation: "Count delayed orders delivered in the previous calendar month relative to the dataset max order date.",
      queryPlan: ["Find latest order_date in dataset", "Select previous calendar month", "Count rows where status is delayed and delivery_date falls inside the resolved range"],
      methodology: "The dataset has no promised delivery date, so status=delayed is the late-delivery proxy. The phrase 'delivered late last month' is resolved on delivery_date.",
      sourceRows: delayed.length
    };

    return withExplanation({
      mode: "deterministic",
      question,
      answer: `${delayed.length} orders were delivered late from ${filters.from} to ${filters.to}.`,
      intent: { tool: "analytics_query", metric: "delayed_orders", dimensions: ["month"], chart: "bar" },
      chart: {
        type: "bar",
        title: "Late orders delivered last month",
        xKey: "status",
        yKey: "orders",
        data: [{ status: "delayed", orders: delayed.length }]
      },
      table: delayed.slice(0, 10).map((row) => ({
        orderId: row.orderId,
        orderDate: row.orderDate,
        deliveryDate: row.deliveryDate as string,
        carrier: row.carrier,
        region: row.region,
        status: row.status
      })),
      explainability
    });
  }

  if ((text.includes("delayed") || text.includes("late")) && (text.includes("week") || text.includes("weekly"))) {
    const filters = text.includes("last 3 months") || text.includes("last three months") ? lastThreeMonths(rows) : {};
    const data = delayedByWeek(rows, filters);
    const total = data.reduce((sum, row) => sum + row.delayedOrders, 0);
    const explainability: Explainability = {
      filters,
      metrics: ["delayed_orders"],
      dimensions: ["order_week"],
      timeGrain: "week",
      interpretation: "Group delayed orders by order week.",
      queryPlan: ["Interpret the question as a delayed-order weekly trend", "Apply a dataset-relative date filter if requested", "Group delayed rows by ISO week of order_date"],
      methodology: "Rows with status=delayed count as delayed deliveries.",
      sourceRows: total
    };

    return withExplanation({
      mode: "deterministic",
      question,
      answer: `Found ${total} delayed orders${filters.from ? ` from ${filters.from} to ${filters.to}` : ""}.`,
      intent: { tool: "analytics_query", metric: "delayed_orders", dimensions: ["week"], chart: "bar" },
      chart: {
        type: "bar",
        title: "Delayed orders by week",
        xKey: "week",
        yKey: "delayedOrders",
        data
      },
      table: data,
      explainability
    });
  }

  return unsupported(
    question,
    "This backend currently supports delayed-order weekly trends, carrier delay-rate ranking, late-order counts for last month, and bounded demand forecasts."
  );
}
