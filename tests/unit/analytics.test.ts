import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseLogisticsCsv } from "@/lib/data/csv";
import { summarizeDashboard, highestCarrierDelayRate, latestOrderDate } from "@/lib/analytics/dashboard";
import { forecastDemand } from "@/lib/analytics/forecast";
import { answerQuestion } from "@/lib/ai/interpreter";
import { answerQuestionWithOpenAI } from "@/lib/ai/openaiIntent";
import { shouldUsePostgres } from "@/lib/data/logisticsRepository";
import { mapPostgresOrder } from "@/lib/data/postgresLogisticsRepository";

const csv = `client_id,order_id,order_date,delivery_date,carrier,origin_city,destination_city,status,sku,product_category,quantity,unit_price_usd,order_value_usd,is_promo,promo_discount_pct,region,warehouse
CL-1,O-1,2025-01-01,2025-01-03,DHL,A,B,delivered,SKU-1,PAPER,2,10,20,0,0,UK,LON
CL-1,O-2,2025-01-08,2025-01-12,DHL,A,B,delayed,SKU-1,PAPER,3,10,30,0,0,UK,LON
CL-1,O-3,2025-02-01,2025-02-04,FedEx,A,B,delayed,SKU-2,BOOK,4,10,40,0,0,US,NYC
CL-1,O-4,2025-02-03,,FedEx,A,B,in_transit,SKU-2,BOOK,5,10,50,0,0,US,NYC
CL-1,O-5,2025-03-01,2025-03-02,FedEx,A,B,delivered,SKU-2,BOOK,6,10,60,0,0,US,NYC`;

const rows = parseLogisticsCsv(csv);

const deliveryWindowCsv = `client_id,order_id,order_date,delivery_date,carrier,origin_city,destination_city,status,sku,product_category,quantity,unit_price_usd,order_value_usd,is_promo,promo_discount_pct,region,warehouse
CL-2,O-10,2025-10-28,2025-11-02,DHL,A,B,delayed,SKU-9,PAPER,1,10,10,0,0,UK,LON
CL-2,O-11,2025-11-15,2025-12-01,DHL,A,B,delayed,SKU-9,PAPER,1,10,10,0,0,UK,LON
CL-2,O-12,2025-11-20,2025-12-05,DHL,A,B,delayed,SKU-9,PAPER,1,10,10,0,0,UK,LON
CL-2,O-13,2025-12-20,2025-12-22,DHL,A,B,delivered,SKU-9,PAPER,1,10,10,0,0,UK,LON`;

const deliveryWindowRows = parseLogisticsCsv(deliveryWindowCsv);

const originalFetch = global.fetch;
const originalOpenAiKey = process.env.OPENAI_API_KEY;

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
  if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiKey;
});

describe("logistics analytics", () => {
  it("computes dashboard KPIs from the read-only dataset", () => {
    const summary = summarizeDashboard(rows);
    expect(summary.kpis.totalOrders).toBe(5);
    expect(summary.kpis.deliveredOrders).toBe(2);
    expect(summary.kpis.delayedOrders).toBe(2);
    expect(summary.kpis.onTimeRate).toBe(50);
    expect(summary.kpis.averageDeliveryDays).toBe(2.5);
    expect(summary.charts.orderVolume.data).toEqual([
      { month: "2025-01", orders: 2 },
      { month: "2025-02", orders: 2 },
      { month: "2025-03", orders: 1 }
    ]);
  });

  it("filters every chart and KPI by operational dimensions", () => {
    const summary = summarizeDashboard(rows, { region: "US", productCategory: "BOOK" });
    expect(summary.kpis.totalOrders).toBe(3);
    expect(summary.kpis.delayedOrders).toBe(1);
    expect(summary.tablePreview.every((row) => row.region === "US" && row.productCategory === "BOOK")).toBe(true);
  });

  it("finds the carrier with highest delay rate", () => {
    expect(highestCarrierDelayRate(rows)).toMatchObject({
      carrier: "DHL",
      delayRate: 50,
      completedOrders: 2,
      delayedOrders: 1
    });
  });

  it("forecasts demand with deterministic monthly output", () => {
    const forecast = forecastDemand(rows, {}, 2);
    expect(forecast.forecast).toHaveLength(2);
    expect(forecast.forecast[0]).toHaveProperty("month", "2025-04");
    expect(forecast.chart.data.some((point) => point.series === "forecast")).toBe(true);
  });

  it("returns a zero-demand forecast for empty filtered segments", () => {
    const forecast = forecastDemand(rows, { sku: "NO-SUCH-SKU" }, 2);
    expect(forecast.history).toEqual([]);
    expect(forecast.forecast).toEqual([
      { month: "2025-04", quantity: 0 },
      { month: "2025-05", quantity: 0 }
    ]);

    expect(forecastDemand([], {}, 2).forecast).toEqual([]);
  });

  it("rejects malformed CSV rows at the data boundary", () => {
    expect(() => parseLogisticsCsv(`${csv}\nCL-1,O-BAD,2025-01-01`)).toThrow("Unexpected logistics CSV column count");
    expect(() => parseLogisticsCsv(csv.replace(",2,10,20,", ",not-a-number,10,20,"))).toThrow("Invalid numeric value");
    expect(() => parseLogisticsCsv(csv.replace(",2,10,20,", ",,10,20,"))).toThrow("Invalid numeric value");
    expect(parseLogisticsCsv(`${csv},`).at(-1)?.warehouse).toBe("NYC");
  });

  it("routes natural-language questions to analytical tools with explainability", () => {
    const answer = answerQuestion(rows, "Which carrier has the highest delay rate?");
    expect(answer.answer).toContain("highest completed-order delay rate");
    expect(answer.table[0]).toMatchObject({ carrier: "DHL", completedOrders: 2, delayedOrders: 1 });
    expect(answer.explainability.queryPlan.join(" ")).toContain("Group completed orders by carrier");
  });

  it("uses delivery_date semantics for late orders last month", () => {
    const answer = answerQuestion(deliveryWindowRows, "How many orders were delivered late last month?");
    expect(answer.answer).toContain("1 orders were delivered late from 2025-11-01 to 2025-11-30.");
    expect(answer.table).toEqual([
      {
        orderId: "O-10",
        orderDate: "2025-10-28",
        deliveryDate: "2025-11-02",
        carrier: "DHL",
        region: "UK",
        status: "delayed"
      }
    ]);
  });

  it("scopes forecast requests to the requested entity and horizon", () => {
    const answer = answerQuestion(rows, "Predict demand for SKU SKU-2 for the next 2 months");
    expect(answer.answer).toContain("Forecasted SKU SKU-2 demand for the next 2 months");
    expect(answer.explainability.filters).toMatchObject({ sku: "SKU-2" });
    expect(answer.table).toHaveLength(4);
    expect(answer.table[0]).toMatchObject({ month: "2025-02", quantity: 9, series: "actual" });
    expect(answer.table[3]).toMatchObject({ month: "2025-05", series: "forecast" });
  });

  it("routes inventory planning to total demand forecasting with a recommendation", () => {
    const answer = answerQuestion(rows, "How much inventory should I plan?");
    expect(answer.intent.tool).toBe("forecast");
    expect(answer.answer).toContain("Forecasted total demand for the next 4 months");
    expect(answer.chart.type).toBe("line");
    expect(answer.recommendation).toContain("Plan around");
    expect(answer.explainability.methodology).toContain("moving-average");
  });

  it("clamps forecast horizons to the supported range", () => {
    const answer = answerQuestion(rows, "Predict demand for the next 24 months");
    expect(answer.intent.tool).toBe("forecast");
    expect(answer.table.filter((row) => row.series === "forecast")).toHaveLength(12);
  });

  it("rejects unsupported questions instead of fabricating a delayed-order trend", () => {
    const answer = answerQuestion(rows, "Why did FedEx underperform in Q1?");
    expect(answer.answer).toContain("Unsupported query:");
    expect(answer.chart.type).toBe("table");
    expect(answer.table[0]).toMatchObject({
      example: "Show delayed orders by week for the last 3 months"
    });
  });

  it("uses deterministic fallback when no OpenAI key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const answer = await answerQuestionWithOpenAI(rows, "Which carrier has the highest delay rate?");
    expect(answer.mode).toBe("deterministic");
    expect(answer.answer).toContain("highest completed-order delay rate");
  });

  it("falls back safely when OpenAI returns malformed structured output", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{not-json" } }] })
    } as Response);

    const answer = await answerQuestionWithOpenAI(rows, "Which carrier has the highest delay rate?");

    expect(answer.mode).toBe("deterministic");
    expect(answer.answer).toContain("highest completed-order delay rate");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("falls back safely when OpenAI request fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "rate_limited" })
    } as Response);

    const answer = await answerQuestionWithOpenAI(rows, "How many orders were delivered late last month?");

    expect(answer.mode).toBe("deterministic");
    expect(answer.answer).toContain("orders were delivered late");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("uses valid OpenAI structured intent only to route into deterministic tools", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              tool: "forecast",
              metric: "demand",
              dimensions: ["month"],
              filters: { relativeTime: null, sku: null, productCategory: null, warehouse: null },
              horizonMonths: 4,
              chart: "line",
              explanation: "Inventory planning questions are treated as monthly demand forecasts."
            })
          }
        }]
      })
    } as Response);

    const answer = await answerQuestionWithOpenAI(rows, "How much inventory should I plan?");

    expect(answer.mode).toBe("openai");
    expect(answer.question).toBe("How much inventory should I plan?");
    expect(answer.intent.tool).toBe("forecast");
    expect(answer.answer).toContain("Forecasted total demand");
    expect(answer.recommendation).toContain("Plan around");
    expect(answer.explainability.queryPlan[0]).toBe("OpenAI structured intent classification");
    expect(answer.explainability.interpretation).toBe("Inventory planning questions are treated as monthly demand forecasts.");
  });
});

describe("canonical logistics dataset", () => {
  const realRows = parseLogisticsCsv(readFileSync("data/logistics.csv", "utf8"));

  it("locks the provided dataset profile", () => {
    const summary = summarizeDashboard(realRows);
    expect(realRows).toHaveLength(400);
    expect(latestOrderDate(realRows)).toBe("2025-12-30");
    expect(summary.kpis.totalOrders).toBe(400);
    expect(summary.kpis.deliveredOrders).toBe(304);
    expect(summary.kpis.delayedOrders).toBe(55);
    expect(summary.kpis.onTimeRate).toBe(84.7);
    expect(summary.kpis.averageDeliveryDays).toBe(3.7);
  });

  it("answers required examples against the canonical dataset", () => {
    expect(answerQuestion(realRows, "Show delayed orders by week for the last 3 months").explainability.filters).toEqual({
      from: "2025-10-01",
      to: "2025-12-30"
    });
    expect(answerQuestion(realRows, "How many orders were delivered late last month?").answer).toContain("from 2025-11-01 to 2025-11-30");
    const forecast = answerQuestion(realRows, "Predict demand for SKU CRAYON-0017 for the next 4 months");
    expect(forecast.intent.tool).toBe("forecast");
    expect(forecast.table.filter((row) => row.series === "forecast")).toHaveLength(4);
    expect(forecast.explainability.filters).toMatchObject({ sku: "CRAYON-0017" });
    const inventory = answerQuestion(realRows, "How much inventory should I plan?");
    expect(inventory.intent.tool).toBe("forecast");
    expect(inventory.recommendation).toContain("Plan around");
  });
});

describe("postgres integration", () => {
  it("defines a typed logistics_orders migration", () => {
    const migration = readFileSync("db/migrations/001_create_logistics_orders.sql", "utf8");
    expect(migration).toContain("create table if not exists public.logistics_orders");
    expect(migration).toContain("order_id text primary key");
    expect(migration).toContain("unit_price_usd numeric(10, 2)");
    expect(migration).toContain("order_value_usd numeric(12, 2)");
    expect(migration).toContain("create index if not exists logistics_orders_order_date_idx");
    expect(migration).not.toMatch(/grant\s+all|create\s+policy/i);
  });

  it("maps postgres rows into the logistics domain model", () => {
    expect(mapPostgresOrder({
      client_id: "CL-1",
      order_id: "O-1",
      order_date: new Date("2025-01-01T00:00:00Z"),
      delivery_date: null,
      carrier: "DHL",
      origin_city: "A",
      destination_city: "B",
      status: "in_transit",
      sku: "SKU-1",
      product_category: "PAPER",
      quantity: "2",
      unit_price_usd: "10.50",
      order_value_usd: "21.00",
      is_promo: false,
      promo_discount_pct: "0",
      region: "UK",
      warehouse: "LON"
    })).toMatchObject({
      clientId: "CL-1",
      orderId: "O-1",
      deliveryDate: null,
      status: "in_transit",
      quantity: 2,
      unitPriceUsd: 10.5,
      orderValueUsd: 21,
      isPromo: false
    });
  });

  it("selects the postgres repository only when explicitly configured or DATABASE_URL exists", () => {
    const oldSource = process.env.LOGISTICS_DATA_SOURCE;
    const oldDatabaseUrl = process.env.DATABASE_URL;

    delete process.env.LOGISTICS_DATA_SOURCE;
    delete process.env.DATABASE_URL;
    expect(shouldUsePostgres()).toBe(false);

    process.env.DATABASE_URL = "postgres://user:password@localhost:5432/logistics";
    expect(shouldUsePostgres()).toBe(true);

    process.env.LOGISTICS_DATA_SOURCE = "csv";
    expect(shouldUsePostgres()).toBe(false);

    process.env.LOGISTICS_DATA_SOURCE = "postgres";
    delete process.env.DATABASE_URL;
    expect(shouldUsePostgres()).toBe(true);

    if (oldSource === undefined) delete process.env.LOGISTICS_DATA_SOURCE;
    else process.env.LOGISTICS_DATA_SOURCE = oldSource;
    if (oldDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldDatabaseUrl;
  });
});
