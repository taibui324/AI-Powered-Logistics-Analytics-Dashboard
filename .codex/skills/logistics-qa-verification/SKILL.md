---
name: logistics-qa-verification
description: "Use for QA, acceptance testing, regression checks, browser verification, data/API/UI contract checks, deployment readiness, README review, and final release verification of the logistics analytics dashboard."
---

# Logistics QA Verification

## Acceptance Areas

- Dashboard displays required KPIs.
- Dashboard includes at least two required chart families.
- Natural-language interface handles the required sample questions.
- Dynamic charts are generated from computed data.
- Every answer or chart includes explainability and underlying data access.
- Forecasting returns values, historical-plus-forecast visualization, recommendation, and method explanation.
- README covers setup, environment variables, architecture, AI approach, assumptions, limitations, and future improvements.

## Test Strategy

- Start with data-level checks for metric definitions and aggregation output.
- Cross-check API or computation contracts against frontend render assumptions.
- Exercise the required natural-language examples:
  - "Show delayed orders by week for the last 3 months"
  - "Which carrier has the highest delay rate?"
  - "How many orders were delivered late last month?"
  - "Predict demand for SKU X for the next 4 months"
- Test unsupported or ambiguous questions for safe failure.
- Verify deployment build and secret handling before submission.

## Evidence

Record commands run, browser checks, screenshots when useful, and any residual risk. Do not claim deployment success unless the public URL was actually checked.

## Defect Reporting

Lead with severity and user impact. Include file paths, line numbers when possible, reproduction steps, expected behavior, and actual behavior.
