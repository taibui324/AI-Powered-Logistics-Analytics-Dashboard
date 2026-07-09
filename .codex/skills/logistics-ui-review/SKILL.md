---
name: logistics-ui-review
description: "Use for designing, implementing, or reviewing the logistics dashboard UI, KPI cards, charts, natural-language answer panel, dynamic chart rendering, explainability sections, tables, and responsive behavior."
---

# Logistics UI Review

## Product Shape

The first screen should be the working analytics dashboard. This is an operational tool, so prioritize scannable information, compact controls, and clear data hierarchy.

## Required UI Areas

- KPI strip for total orders, delivered orders, delayed orders, on-time delivery rate, and average delivery time.
- At least two charts covering order volume over time, delivery performance, carrier breakdown, or destination breakdown.
- Natural-language question input with answer, dynamic chart, explainability, and underlying data access.
- Forecasting view or response pattern with historical and forecast data in one visualization.

## Design Guidance

- Keep layouts dense but readable.
- Use chart labels, legends, and units that make logistics metrics unambiguous.
- Use stable dimensions so chart and KPI areas do not shift during loading or updates.
- Avoid marketing-page hero treatment unless the user explicitly asks for a landing page.
- Make filters and interpretation visible without overwhelming the primary answer.

## Review Checklist

- KPI and chart sections are visible and usable on desktop and mobile.
- Natural-language results show direct answer, chart or table, filters, metrics, dimensions, and interpretation.
- Dynamic chart type selection is visible through the rendered chart, not only text.
- Empty, loading, unsupported, and error states are handled.
