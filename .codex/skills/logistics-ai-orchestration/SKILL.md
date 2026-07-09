---
name: logistics-ai-orchestration
description: "Use for designing, implementing, or reviewing the logistics natural-language query layer, AI tool routing, structured intent parsing, dynamic chart generation, answer explainability, and hallucination guardrails."
---

# Logistics AI Orchestration

## Core Principle

AI is the router and explainer, not the source of truth. It must never produce business metrics without calling deterministic computation.

## Required Flow

`User question -> structured interpretation -> tool selection -> validated tool input -> computation -> answer -> explanation -> visualization`

## Supported Tool Families

- **Analytics query tool:** KPIs, aggregations, grouped breakdowns, and historical charts.
- **Forecasting tool:** Demand prediction, historical-plus-forecast chart, inventory recommendation, and methodology explanation.

## Intent Contract

Prefer a validated structured intent with these fields:

- `tool`: `analytics_query` or `forecast`
- `metric`: bounded enum such as `orders`, `delayed_orders`, `delay_rate`, `delivery_time`, or `demand`
- `dimensions`: bounded list such as `week`, `month`, `carrier`, `destination`, or `sku`
- `filters`: time range, carrier, destination, SKU, status
- `chart`: requested or inferred chart type
- `explanation`: concise interpretation of the user's question

Unsupported fields or ambiguous intent should produce a clarification or bounded unsupported response.

## Guardrails

- Do not execute raw AI-generated SQL.
- Do not answer from model memory.
- Validate all dimensions, metrics, filters, date ranges, and chart types.
- Generate chart specs only from returned rows.
- Include filters used, metrics, dimensions, query plan or structured interpretation, and underlying rows or summary.

## Review Checklist

- Required example questions route to computation.
- Unsupported questions fail safely.
- Forecasting questions do not hit the descriptive analytics path.
- UI receives a stable response shape for direct answers, charts, explanations, and tables.
