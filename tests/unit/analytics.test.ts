import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLogisticsCsv } from "@/lib/data/csv";
import { summarizeDashboard, highestCarrierDelayRate, latestOrderDate } from "@/lib/analytics/dashboard";
import { forecastDemand } from "@/lib/analytics/forecast";
import { answerQuestion } from "@/lib/ai/interpreter";
import { answerQuestionWithOpenAI } from "@/lib/ai/openaiIntent";
import { shouldUseSupabase } from "@/lib/data/logisticsRepository";
import { mapSupabaseOrder } from "@/lib/data/supabaseLogisticsRepository";

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

  it("rejects unsupported questions instead of fabricating a delayed-order trend", () => {
    const answer = answerQuestion(rows, "Why did FedEx underperform in Q1?");
    expect(answer.answer).toContain("Unsupported query:");
    expect(answer.chart.type).toBe("table");
    expect(answer.table[0]).toMatchObject({
      example: "Show delayed orders by week for the last 3 months"
    });
  });

  it("uses deterministic fallback when no OpenAI key is configured", async () => {
    const oldKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const answer = await answerQuestionWithOpenAI(rows, "Which carrier has the highest delay rate?");
    expect(answer.mode).toBe("deterministic");
    expect(answer.answer).toContain("highest completed-order delay rate");
    process.env.OPENAI_API_KEY = oldKey;
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
  });
});

describe("supabase postgres integration", () => {
  it("defines a read-only logistics_orders migration", () => {
    const migration = readFileSync("supabase/migrations/001_create_logistics_orders.sql", "utf8");
    expect(migration).toContain("create table if not exists public.logistics_orders");
    expect(migration).toContain("order_id text primary key");
    expect(migration).toContain("unit_price_usd numeric(10, 2)");
    expect(migration).toContain("order_value_usd numeric(12, 2)");
    expect(migration).toContain("alter table public.logistics_orders enable row level security");
    expect(migration).toContain("grant select on table public.logistics_orders to anon, authenticated");
    expect(migration).toContain("for select");
    expect(migration).not.toMatch(/for\s+(insert|update|delete)/i);
  });

  it("maps supabase rows into the logistics domain model", () => {
    expect(mapSupabaseOrder({
      client_id: "CL-1",
      order_id: "O-1",
      order_date: "2025-01-01",
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

  it("selects the supabase repository only when explicitly configured or env vars exist", () => {
    const oldSource = process.env.LOGISTICS_DATA_SOURCE;
    const oldUrl = process.env.SUPABASE_URL;
    const oldAnon = process.env.SUPABASE_ANON_KEY;

    delete process.env.LOGISTICS_DATA_SOURCE;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    expect(shouldUseSupabase()).toBe(false);

    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon";
    expect(shouldUseSupabase()).toBe(true);

    process.env.LOGISTICS_DATA_SOURCE = "csv";
    expect(shouldUseSupabase()).toBe(false);

    process.env.LOGISTICS_DATA_SOURCE = "supabase";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    expect(shouldUseSupabase()).toBe(true);

    if (oldSource === undefined) delete process.env.LOGISTICS_DATA_SOURCE;
    else process.env.LOGISTICS_DATA_SOURCE = oldSource;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = oldAnon;
  });
});
