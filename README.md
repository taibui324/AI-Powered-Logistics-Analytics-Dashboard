# Logistics AI Analytics

A Next.js dashboard for the logistics analytics assignment. It uses one unified logistics dataset for dashboard KPIs, natural-language analytical answers, dynamic charts, and monthly demand forecasting. The provided CSV is the seed/reference dataset; Supabase PostgreSQL is supported as the read-only runtime database.

## Local Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Useful checks:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

To seed Supabase after applying `supabase/migrations/001_create_logistics_orders.sql`:

```bash
npm run db:import
```

## Environment

- `OPENAI_API_KEY`: optional. The app works without it through deterministic fallback routing for the required examples.
- `OPENAI_MODEL`: optional. Defaults to `gpt-5.4-mini` for structured intent classification when `OPENAI_API_KEY` is present.
- `LOGISTICS_DATA_SOURCE`: optional. Use `supabase` to require Supabase, `csv` to force the local CSV, or leave unset to use Supabase when `SUPABASE_URL` and `SUPABASE_ANON_KEY` exist.
- `SUPABASE_URL`: Supabase project URL for PostgreSQL-backed runtime reads.
- `SUPABASE_ANON_KEY`: read-only Supabase anon/publishable key used by server route handlers.
- `SUPABASE_SERVICE_ROLE_KEY`: import-only secret for `npm run db:import`; never expose it to browser/client code.
- `NEXT_PUBLIC_DEPLOYMENT_URL`: optional deployment URL. Current deployment is `https://ai-analytics-dashboard-puce.vercel.app`.

## Architecture And Data Flow

- `data/logistics.csv` is the canonical read-only seed copied from `mock_logistics_data (1).csv`.
- `supabase/migrations/001_create_logistics_orders.sql` creates the read-only `public.logistics_orders` table, typed constraints, indexes, and select-only RLS policy.
- `scripts/import-logistics-csv.mjs` imports the CSV into Supabase with the service role for operator-controlled seeding.
- `src/lib/data` exposes a repository boundary that reads from Supabase when configured and falls back to the CSV fixture locally.
- `src/lib/analytics` computes KPIs, filters, chart rows, carrier delay rankings, relative date windows, and forecasts.
- `src/lib/ai/interpreter.ts` converts supported questions into bounded structured intents.
- `src/app/api/dashboard` and `src/app/api/ask` expose the shared analytics layer to the UI.
- `src/components` renders KPIs, charts, filters, analyst answers, explainability, and table previews.

Flow: user filters or question -> API route -> typed data repository -> analytics or forecast tool -> chart spec, table data, explanation -> React dashboard.

## AI Approach

AI is treated as orchestration only. When `OPENAI_API_KEY` is present, `/api/ask` asks OpenAI for a structured intent and validates it before calling local tools. Without the key, the deterministic fallback parser handles the required examples. In both modes, analytical answers are computed by deterministic tools, and unsupported prompts return a limitation plus examples instead of fabricated metrics.

The supported examples are:

- `Show delayed orders by week for the last 3 months`
- `Which carrier has the highest delay rate?`
- `How many orders were delivered late last month?`
- `Predict demand for SKU CRAYON-0017 for the next 4 months`

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

- Supabase must be seeded from `data/logistics.csv` before enabling `LOGISTICS_DATA_SOURCE=supabase` in production.
- The fallback interpreter intentionally supports a bounded question set.
- Forecasting is deterministic and explainable, not a production statistical model.

## Future Improvements

- Add Supabase deployment automation and scheduled seed/parity checks for larger datasets.
- Add forecast confidence bands once enough history exists per SKU/category.
- Expand OpenAI structured intent parsing once model credentials and evals are ready.

## Deployment

Repository: `https://github.com/taibui324/AI-Powered-Logistics-Analytics-Dashboard`

Public URL: `https://ai-analytics-dashboard-puce.vercel.app`

Build locally with `npm run build`. The current deployment was created with:

```bash
npx vercel deploy --yes
```
