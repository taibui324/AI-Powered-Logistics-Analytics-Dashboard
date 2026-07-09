# AGENTS.md

## Codex Harness: Logistics AI Analytics Dashboard

**Goal:** Coordinate Codex subagents and project-local skills for the logistics dashboard, AI tool routing, data correctness, UI review, QA, deployment readiness, and plan maintenance.

**Trigger:** For logistics dashboard implementation, review, QA, plan updates, AI orchestration, forecasting, charting, deployment, or subagent delegation, use `.codex/skills/logistics-dashboard-orchestrator/SKILL.md`. Simple factual questions can be answered directly.

**Codex delegation rules:** Use `multi_agent_v1.spawn_agent` only when the user explicitly asks for subagents, delegation, or parallel agent work. Keep the immediate blocking task local, delegate bounded sidecar work, and give coding subagents disjoint write scopes. Use built-in Codex roles mapped by the orchestrator and the project profiles in `.codex/agents/`. Do not set model overrides unless the user asks or there is a clear task-specific reason.

**Harness assets:**

- `.codex/agents/` contains reusable project role profiles.
- `.codex/skills/` contains reusable workflow and review instructions.
- `.codex/skills/logistics-dashboard-orchestrator/SKILL.md` is the primary entry point.

## Plan-Derived Required Checks

Use [docs/plans/2026-07-09-001-feat-logistics-analytics-dashboard-plan.md](/Users/taibui/Desktop/project/ai-analytics-dashboard/docs/plans/2026-07-09-001-feat-logistics-analytics-dashboard-plan.md) as the implementation source of truth. Before finishing any implementation, review, QA, deployment, or plan-update task, check the relevant items below and report any skipped checks with a reason.

### Product Requirements

- **Unified read-only dataset:** Dashboard KPIs, natural-language analytics, dynamic charts, and forecasting must all use the same canonical logistics dataset. Do not add a second parsing path or mutate source data.
- **Dataset-relative dates:** Relative analytical ranges such as "last month" or "last 3 months" must resolve against the dataset maximum `order_date`, not the real current date. The plan expects `2025-12-30` for the provided dataset metadata.
- **Dashboard KPIs:** The dashboard must show total orders, delivered orders, delayed orders, on-time delivery rate, and average delivery time.
- **Dashboard charts:** The dashboard must render order volume over time, delivery performance split by status, and a carrier or destination breakdown.
- **Dashboard filters:** Support date range, carrier, region, warehouse, and product category when those dimensions exist in the dataset.
- **Required analyst prompts:** The natural-language interface must handle delayed orders by week for the last 3 months, highest carrier delay rate, delivered late last month, and demand forecast for an SKU or close equivalent.
- **Structured AI interpretation:** Questions must be converted into validated structured inputs naming intent, metric, dimension, time range, filters, grain, and desired visualization.
- **Tool-computed answers:** AI may route and explain, but all analytical answers must come from the analytics query tool or forecasting tool. Never fabricate metrics from model prose.
- **Unsupported prompts:** Unsupported questions must return a clear limitation plus suggested examples.
- **Dynamic chart contract:** Chart types must come from a bounded chart contract and render from computed rows. Use table fallback when a chart would mislead.
- **Explainability:** Every answer and generated chart must expose filters, metrics, dimensions, time grain, structured interpretation or query plan, and underlying summary data.
- **Forecasting:** Forecast demand from historical dataset values for total demand, SKU, product category, or warehouse over a monthly horizon. Return historical values, forecast values, chart-ready combined series, inventory recommendation, and documented deterministic methodology.
- **AI safety:** Avoid raw model-generated SQL. Prefer validated analytical DSL or typed request schemas. The app must still answer required examples through deterministic fallback when `OPENAI_API_KEY` is absent.
- **Deployment and docs:** Public URL must be unauthenticated and usable without local setup. Secrets must be env vars only. `README.md` must cover setup, env vars, architecture, data flow, AI approach, assumptions, limitations, future improvements, repository link, and deployment URL.

### Acceptance Examples

- "Show delayed orders by week for the last 3 months" returns weekly delayed-order totals, a line or bar chart, the resolved dataset-relative 3-month window, and weekly table data.
- "Which carrier has the highest delay rate?" returns the top carrier by delayed divided by delivered-plus-delayed orders, a ranked carrier chart, and denominators.
- "How many orders were delivered late last month?" resolves last month against the dataset maximum date, uses `status=delayed`, returns a computed count, and explains the date range.
- "Predict demand for SKU X for the next 4 months" returns historical monthly demand, four forecast points, a chart, inventory recommendation, and forecasting method when enough data exists.
- Unsupported open-ended questions explain the limitation and offer supported prompts.

### Implementation Unit Checks

- **U1 scaffold:** App boots locally, renders a non-empty dashboard shell, ignores local env files, and documents scripts for lint, unit tests, e2e tests, and production build.
- **U2 data module:** Canonical CSV loads as typed rows, required columns are validated, the current dataset profile is locked by tests, empty delivery dates are allowed, numeric fields are numbers, metadata exposes max `order_date`, status counts match the dataset profile, and all analytics import from this module.
- **U3 analytics tool:** KPI, grouping, filtering, sorting, top-N, empty-state, and invalid-input behavior are deterministic. Last-3-month, last-month, highest-delay-rate, carrier/region filter, zero-result, and invalid-field cases must be covered. Dashboard API and AI query path must share this tool for overlapping metrics.
- **U4 forecasting tool:** Forecasts reuse shared filters/date utilities, validate horizons and dimensions, avoid negative demand, include confidence or sparse-data notes, increase inventory recommendations when recent volatility is higher, and do not call AI for calculations.
- **U5 ask API:** Interpreter output is schema-validated; fallback parser covers required examples without `OPENAI_API_KEY`; malformed AI output and failed tool validation return safe unsupported responses; API shape includes `answer`, `chart`, `explanation`, `table`, and `unsupportedReason` only when applicable.
- **U6 chart renderer:** Dashboard and analyst charts use the same chart spec and renderer. Time series, ranked carrier rates, status comparisons, sparse data, labels, units, legends, and table fallback are covered.
- **U7 dashboard UI:** Reviewer can load the app and inspect performance without prompting. KPI cards, all three chart families, filters, explainability, data summaries, empty states, mobile layout, and no-auth access are verified.
- **U8 analyst UI:** Example prompts are clickable or discoverable; computed answers show direct answer first, chart second, and explainability/table details compactly. Long text and tables must not overlap on mobile.
- **U9 submission:** README, `.env.example`, deployment config, production build, deployed smoke check, fallback with no API key, no committed secrets, repository URL, live deployment URL, and no authentication requirement are verified.

### Verification Gates

- **Type and lint:** Whole app passes TypeScript and lint with no ignored product errors.
- **Unit tests:** Data parsing, metrics, query routing, forecasting, and chart selection tests pass.
- **API integration:** `/api/ask` and `/api/dashboard` return validated response shapes, shared explainability metadata, and matching results for equivalent dashboard and analyst queries.
- **E2E smoke:** Dashboard loads, all three chart families render, required example prompts work, fallback works without `OPENAI_API_KEY`, and mobile layout has no overlapping primary content.
- **Production build:** App builds for deployment with no committed secrets.
- **Deployed smoke:** Public URL loads core dashboard plus analyst scenarios without local setup.

### Definition of Done

- Working full-stack app, canonical dataset, tests, README, and deployment configuration are present.
- Dashboard displays all required KPIs plus required chart families through the shared analytics layer.
- Natural-language interface handles assignment examples through AI orchestration or deterministic fallback and never fabricates computed answers.
- Every analyst answer and dashboard chart includes filters, metrics, dimensions, structured interpretation, and underlying summary data.
- Forecasting returns historical data, forecast values, visualization-ready output, inventory recommendation, and methodology explanation.
- Public deployment URL is stable, unauthenticated, and documented in `README.md`.
- No secrets are committed, `.env.example` documents required configuration, and abandoned experimental code or unused generated artifacts are removed before submission.

**Change History:**

| Date | Change | Target | Reason |
|------|--------|--------|--------|
| 2026-07-09 | Initial harness setup | all | Enable reusable agent and skill delegation for this repo. |
| 2026-07-09 | Migrated harness to Codex layout | `AGENTS.md`, `.codex/` | Use Codex-native session instructions, subagent roles, and skills. |
| 2026-07-09 | Added plan-derived checks | `AGENTS.md` | Keep future Codex work aligned with the logistics dashboard plan. |
