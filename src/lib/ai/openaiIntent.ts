import { z } from "zod";
import { answerQuestion } from "./interpreter";
import { AnalystAnswer, LogisticsOrder } from "@/lib/analytics/types";

const intentSchema = z.object({
  tool: z.enum(["analytics_query", "forecast", "unsupported"]),
  metric: z.enum(["delayed_orders", "delay_rate", "demand", "unsupported"]),
  dimensions: z.array(z.enum(["week", "month", "carrier", "sku", "product_category", "warehouse"])),
  filters: z.object({
    relativeTime: z.enum(["last_3_months", "last_month"]).nullable(),
    sku: z.string().nullable(),
    productCategory: z.string().nullable(),
    warehouse: z.string().nullable()
  }),
  horizonMonths: z.number().int().min(1).max(12).nullable(),
  chart: z.enum(["line", "bar", "pie", "table"]),
  explanation: z.string()
});

type Intent = z.infer<typeof intentSchema>;

function promptFromIntent(intent: Intent) {
  if (intent.tool === "forecast") {
    const horizon = intent.horizonMonths ?? 4;
    if (intent.filters.sku) return `Predict demand for SKU ${intent.filters.sku} for the next ${horizon} months`;
    if (intent.filters.productCategory) return `Predict demand for product category ${intent.filters.productCategory} for the next ${horizon} months`;
    if (intent.filters.warehouse) return `Predict demand for warehouse ${intent.filters.warehouse} for the next ${horizon} months`;
    return `Predict demand for the next ${horizon} months`;
  }
  if (intent.metric === "delay_rate" && intent.dimensions.includes("carrier")) {
    return "Which carrier has the highest delay rate?";
  }
  if (intent.metric === "delayed_orders" && intent.filters.relativeTime === "last_month") {
    return "How many orders were delivered late last month?";
  }
  if (intent.metric === "delayed_orders" && intent.dimensions.includes("week")) {
    return intent.filters.relativeTime === "last_3_months"
      ? "Show delayed orders by week for the last 3 months"
      : "Show delayed orders by week";
  }
  return "unsupported";
}

function outputText(payload: unknown) {
  const response = payload as { output_text?: string; choices?: { message?: { content?: string } }[] };
  return response.output_text ?? response.choices?.[0]?.message?.content ?? "";
}

export async function answerQuestionWithOpenAI(rows: LogisticsOrder[], question: string): Promise<AnalystAnswer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return answerQuestion(rows, question);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
        messages: [
          {
            role: "system",
            content:
              "Classify logistics analytics questions into the provided JSON schema. Treat inventory-planning questions such as 'How much inventory should I plan?' as monthly demand forecasts. Return unsupported for anything outside delayed order trends, carrier delay rate, late orders last month, monthly demand forecasts, or inventory planning from forecasted demand. Do not compute metrics."
          },
          { role: "user", content: question }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "logistics_intent",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["tool", "metric", "dimensions", "filters", "horizonMonths", "chart", "explanation"],
              properties: {
                tool: { enum: ["analytics_query", "forecast", "unsupported"] },
                metric: { enum: ["delayed_orders", "delay_rate", "demand", "unsupported"] },
                dimensions: {
                  type: "array",
                  items: { enum: ["week", "month", "carrier", "sku", "product_category", "warehouse"] }
                },
                filters: {
                  type: "object",
                  additionalProperties: false,
                  required: ["relativeTime", "sku", "productCategory", "warehouse"],
                  properties: {
                    relativeTime: { anyOf: [{ enum: ["last_3_months", "last_month"] }, { type: "null" }] },
                    sku: { anyOf: [{ type: "string" }, { type: "null" }] },
                    productCategory: { anyOf: [{ type: "string" }, { type: "null" }] },
                    warehouse: { anyOf: [{ type: "string" }, { type: "null" }] }
                  }
                },
                horizonMonths: { anyOf: [{ type: "integer", minimum: 1, maximum: 12 }, { type: "null" }] },
                chart: { enum: ["line", "bar", "pie", "table"] },
                explanation: { type: "string" }
              }
            }
          }
        }
      })
    });

    if (!response.ok) return answerQuestion(rows, question);
    const intent = intentSchema.parse(JSON.parse(outputText(await response.json())));
    const answer = answerQuestion(rows, promptFromIntent(intent));
    return {
      ...answer,
      mode: "openai",
      question,
      explainability: {
        ...answer.explainability,
        interpretation: intent.explanation || answer.explainability.interpretation,
        queryPlan: ["OpenAI structured intent classification", ...answer.explainability.queryPlan]
      },
      explanation: {
        ...answer.explanation,
        interpretation: intent.explanation || answer.explanation.interpretation,
        queryPlan: ["OpenAI structured intent classification", ...answer.explanation.queryPlan]
      }
    };
  } catch {
    return answerQuestion(rows, question);
  }
}
