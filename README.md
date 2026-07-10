# Logistics AI Analytics

A Next.js dashboard for the logistics analytics assignment. It uses one unified read-only logistics dataset for dashboard KPIs, natural-language analytical answers, dynamic charts, and monthly demand forecasting. The provided CSV is the canonical seed and valid runtime source; PostgreSQL is supported as an optional production-style runtime adapter.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

The app is public and does not require authentication.

Useful checks:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

To create and seed the PostgreSQL table from `data/logistics.csv`:

```bash
DATABASE_URL=postgres://user:password@host:5432/database npm run db:import
DATABASE_URL=postgres://user:password@host:5432/database npm run db:verify
```

## Environment

- `OPENAI_API_KEY`: optional. The app works without it through deterministic fallback routing for the required examples.
- `OPENAI_MODEL`: optional. Defaults to `gpt-5.4-mini` for structured intent classification when `OPENAI_API_KEY` is present.
- `LOGISTICS_DATA_SOURCE`: optional. Use `csv` to force the canonical CSV runtime, `postgres` to require PostgreSQL, or leave unset to use PostgreSQL when `DATABASE_URL` exists.
- `DATABASE_URL`: optional PostgreSQL connection string for runtime reads and `npm run db:import` seeding.
- `POSTGRES_SSL`: optional. Leave unset for hosted PostgreSQL that requires SSL; set `false` for local Postgres.
- `NEXT_PUBLIC_DEPLOYMENT_URL`: optional deployment URL. Current deployment is `https://ai-analytics-dashboard-puce.vercel.app`.

## Architecture And Data Flow

- `data/logistics.csv` is the canonical read-only seed and fallback runtime dataset copied from `mock_logistics_data (1).csv`.
- `db/migrations/001_create_logistics_orders.sql` creates the optional `public.logistics_orders` table with typed constraints and indexes.
- `scripts/import-logistics-csv.mjs` applies the migration and imports the CSV into PostgreSQL through `DATABASE_URL`.
- `src/lib/data` exposes a repository boundary that reads from PostgreSQL when configured and falls back to the CSV fixture locally.
- `src/lib/analytics` computes KPIs, filters, chart rows, carrier delay rankings, relative date windows, and forecasts.
- `src/lib/ai/interpreter.ts` converts supported questions into bounded structured intents.
- `src/app/api/dashboard` and `src/app/api/ask` expose the shared analytics layer to the UI.
- `src/components` renders KPIs, charts, filters, analyst answers, explainability, and table previews.

Flow: user filters or question -> API route -> typed data repository -> analytics or forecast tool -> computed result -> chart spec, table data, explanation -> React dashboard.

## AI Approach

AI is treated as orchestration only. When `OPENAI_API_KEY` is present, `/api/ask` asks OpenAI for a structured intent and validates it before calling local tools. Without the key, the deterministic fallback parser handles the required examples. In both modes, analytical answers are computed by deterministic tools, and unsupported prompts return a limitation plus examples instead of fabricated metrics.

The supported examples are:

- `Show delayed orders by week for the last 3 months`
- `Which carrier has the highest delay rate?`
- `How many orders were delivered late last month?`
- `Predict demand for SKU CRAYON-0017 for the next 4 months`
- `How much inventory should I plan?`

OpenAI never receives database credentials and never executes SQL. The model may classify a question into a bounded schema, but TypeScript analytics and forecasting code compute all numbers.

## Assumptions

- `status=delivered` is on time.
- `status=delayed` is late because the dataset has no promised delivery date.
- On-time rate is `delivered / (delivered + delayed)`.
- Average delivery time uses completed delivered/delayed rows with `delivery_date`.
- Relative dates use the dataset maximum `order_date`, `2025-12-30`, not the real current date.
- “Delivered late last month” uses `delivery_date` within the dataset-relative previous month.
- Forecast demand means `sum(quantity)` by month.

## Forecasting

Forecasting aggregates monthly quantity, then projects the requested horizon from the last three months using a moving average plus simple trend. It returns historical rows, forecast rows, a combined chart spec, an inventory recommendation, and methodology.

## Limitations

- CSV runtime is the default assignment-valid data path. PostgreSQL must be seeded from `data/logistics.csv` before enabling `LOGISTICS_DATA_SOURCE=postgres`.
- The fallback interpreter intentionally supports a bounded question set.
- Forecasting is deterministic and explainable, not a production statistical model.
- The app does not include user accounts, saved reports, query history, or live logistics-system ingestion.

## Future Improvements

- Add PostgreSQL deployment automation and scheduled seed/parity checks for larger datasets.
- Add forecast confidence bands once enough history exists per SKU/category.
- Expand OpenAI structured intent parsing once model credentials and evals are ready.

## Deployment

Repository: `https://github.com/taibui324/AI-Powered-Logistics-Analytics-Dashboard`

Public URL: `https://ai-analytics-dashboard-puce.vercel.app`

Build locally with `npm run build`. The current production deployment is connected to GitHub and redeploys automatically from pushes to `main`.

Recent validation screenshots are in `docs/screenshots/`.
