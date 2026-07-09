---
name: logistics-data-correctness
description: "Use for logistics dataset handling, KPI definitions, aggregation correctness, chart data validation, read-only data access, forecasting inputs, and data-quality review."
---

# Logistics Data Correctness

## Source of Truth

Use one unified dataset. Treat it as read-only. Inspect the actual schema before finalizing field mappings.

## KPI Definitions

Document the exact field mapping used for each KPI:

- **Total orders:** count of order records after filters.
- **Delivered orders:** count of records considered delivered by the canonical status or delivered timestamp.
- **Delayed orders:** count of records delivered after promised or estimated delivery date, or records marked delayed when dates are unavailable.
- **On-time delivery rate:** on-time delivered orders divided by delivered orders, unless the plan explicitly chooses another denominator.
- **Average delivery time:** average elapsed time from order date or ship date to delivery date for delivered orders.

## Aggregation Rules

- Parse dates once in the data layer and preserve a canonical date representation.
- Apply filters before aggregation.
- Keep metric calculation centralized so dashboard and natural-language answers share logic.
- Return both summary values and the rows behind charts or tables.
- Record exclusions for missing, invalid, or future dates.

## Forecasting Rules

- Use historical demand from the same dataset.
- Keep the method simple and explainable: moving average, linear regression, exponential smoothing, or a simple trend model.
- Return historical points, forecast points, inventory recommendation, and methodology.
- Include enough sample-size context to avoid overclaiming.

## Verification Checklist

- Dashboard KPIs match query-tool results under the same filters.
- Required example questions produce reproducible rows and totals.
- Chart totals reconcile with underlying table data.
- Forecast input window and output horizon are visible in the explanation.
