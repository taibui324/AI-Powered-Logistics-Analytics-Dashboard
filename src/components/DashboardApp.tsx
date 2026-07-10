"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChartRenderer } from "./ChartRenderer";
import { AnalystAnswer, DashboardFilters, DashboardSummary } from "@/lib/analytics/types";

const DEFAULT_QUESTION = "Which carrier has the highest delay rate?";
const EXAMPLE_PROMPTS = [
  "Show delayed orders by week for the last 3 months",
  "How many orders were delivered late last month?",
  "Predict demand for SKU CRAYON-0017 for the next 4 months"
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function queryString(filters: DashboardFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function SelectFilter({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DashboardApp() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [answer, setAnswer] = useState<AnalystAnswer | null>(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/dashboard?${queryString(filters)}`)
      .then((response) => response.json())
      .then((data) => {
        if (active) setSummary(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filters]);

  useEffect(() => {
    ask(DEFAULT_QUESTION);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ask(nextQuestion = question) {
    setAsking(true);
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: nextQuestion })
    });
    setAnswer(await response.json());
    setAsking(false);
  }

  function onAsk(event: FormEvent) {
    event.preventDefault();
    ask();
  }

  const kpis = useMemo(() => {
    if (!summary) return [];
    return [
      ["Total Orders", formatNumber(summary.kpis.totalOrders), "All orders after filters"],
      ["Delivered Orders", formatNumber(summary.kpis.deliveredOrders), "Completed on time"],
      ["Delayed Orders", formatNumber(summary.kpis.delayedOrders), "Late delivery proxy"],
      ["On-time Delivery Rate", `${summary.kpis.onTimeRate}%`, "Delivered / completed"],
      ["Average Delivery Time", `${summary.kpis.averageDeliveryDays} days`, "Closed deliveries"]
    ];
  }, [summary]);

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <h1>Logistics AI Analytics</h1>
          <p>{loading ? "Refreshing analytics..." : `${summary?.explainability.sourceRows ?? 0} rows in view`}</p>
        </div>
      </header>

      <section className="panel filters" aria-label="Dashboard filters">
        <label className="field date-range">
          <span>Date Range</span>
          <span className="date-inputs">
            <input type="date" value={filters.from ?? ""} onChange={(event) => setFilters({ ...filters, from: event.target.value || undefined })} />
            <input type="date" value={filters.to ?? ""} onChange={(event) => setFilters({ ...filters, to: event.target.value || undefined })} />
          </span>
        </label>
        {summary && (
          <>
            <SelectFilter label="Carrier" value={filters.carrier ?? ""} options={summary.facets.carrier} onChange={(carrier) => setFilters({ ...filters, carrier: carrier || undefined })} />
            <SelectFilter label="Region" value={filters.region ?? ""} options={summary.facets.region} onChange={(region) => setFilters({ ...filters, region: region || undefined })} />
            <SelectFilter label="Warehouse" value={filters.warehouse ?? ""} options={summary.facets.warehouse} onChange={(warehouse) => setFilters({ ...filters, warehouse: warehouse || undefined })} />
            <SelectFilter label="Category" value={filters.productCategory ?? ""} options={summary.facets.productCategory} onChange={(productCategory) => setFilters({ ...filters, productCategory: productCategory || undefined })} />
          </>
        )}
        <button type="button" className="secondary-button" onClick={() => setFilters({})}>
          Clear Filters
        </button>
      </section>

      {!summary && <section className="panel">Loading dashboard...</section>}

      {summary && (
        <>
          <section className="kpi-row" aria-label="Dashboard KPIs">
            {kpis.map(([label, value, detail]) => (
              <article className="metric-card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </section>

          <section className="content-grid">
            <div className="main-column">
              <section className="chart-grid" aria-label="Dashboard charts">
                <article className="panel chart-card wide">
                  <h2>{summary.charts.orderVolume.title}</h2>
                  <ChartRenderer spec={summary.charts.orderVolume} />
                </article>
                <article className="panel chart-card">
                  <h2>{summary.charts.statusSplit.title}</h2>
                  <ChartRenderer spec={summary.charts.statusSplit} />
                </article>
                <article className="panel chart-card">
                  <h2>{summary.charts.carrierDelayRate.title}</h2>
                  <ChartRenderer spec={summary.charts.carrierDelayRate} />
                </article>
                <article className="panel chart-card wide">
                  <h2>{summary.charts.regionBreakdown.title}</h2>
                  <ChartRenderer spec={summary.charts.regionBreakdown} />
                </article>
              </section>

              <section className="panel dashboard-explainability">
                <h2>Dashboard explainability</h2>
                <dl>
                  <dt>Interpretation</dt>
                  <dd>{summary.explainability.interpretation}</dd>
                  <dt>Metrics</dt>
                  <dd>{summary.explainability.metrics.join(", ")}</dd>
                  <dt>Dimensions</dt>
                  <dd>{summary.explainability.dimensions.join(", ")}</dd>
                  <dt>Time grain</dt>
                  <dd>{summary.explainability.timeGrain}</dd>
                  <dt>Filters</dt>
                  <dd>{Object.keys(summary.filters).length ? JSON.stringify(summary.filters) : "none"}</dd>
                  <dt>Query plan</dt>
                  <dd>{summary.explainability.queryPlan.join(" -> ")}</dd>
                  <dt>Rows</dt>
                  <dd>{summary.explainability.sourceRows}</dd>
                </dl>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <h2>Underlying rows</h2>
                  <span>{summary.tablePreview.length} row preview</span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Date</th>
                        <th>Carrier</th>
                        <th>Region</th>
                        <th>Status</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.tablePreview.map((row) => (
                        <tr key={row.orderId}>
                          <td>{row.orderId}</td>
                          <td>{row.orderDate}</td>
                          <td>{row.carrier}</td>
                          <td>{row.region}</td>
                          <td>{row.status}</td>
                          <td>{formatMoney(row.orderValueUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <aside className="panel analyst-panel">
              <div className="panel-header">
                <h2>AI analyst</h2>
                <span>{answer?.mode === "openai" ? "OpenAI" : "Deterministic"}</span>
              </div>
              <form onSubmit={onAsk} className="question-form">
                <textarea value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="Ask a logistics analytics question" />
                <button type="submit" disabled={asking}>{asking ? "Analyzing..." : "Ask"}</button>
              </form>
              <div className="prompt-row">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => { setQuestion(prompt); ask(prompt); }}>
                    {prompt}
                  </button>
                ))}
              </div>
              {answer && (
                <div className="answer-block" aria-live="polite">
                  <p className="answer">{answer.answer}</p>
                  <ChartRenderer spec={answer.chart} height={210} />
                  {answer.recommendation && <p className="recommendation">{answer.recommendation}</p>}
                  <div className="table-scroll mini-table">
                    <table>
                      <thead>
                        <tr>{Object.keys(answer.table[0] ?? {}).map((key) => <th key={key}>{key}</th>)}</tr>
                      </thead>
                      <tbody>
                        {answer.table.slice(0, 8).map((row, index) => (
                          <tr key={index}>
                            {Object.values(row).map((value, valueIndex) => <td key={valueIndex}>{value}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h3>Query Plan</h3>
                  <dl>
                    <dt>Interpretation</dt>
                    <dd>{answer.explainability.interpretation}</dd>
                    <dt>Metrics</dt>
                    <dd>{answer.explainability.metrics.join(", ")}</dd>
                    <dt>Dimensions</dt>
                    <dd>{answer.explainability.dimensions.join(", ")}</dd>
                    <dt>Time grain</dt>
                    <dd>{answer.explainability.timeGrain ?? "none"}</dd>
                    <dt>Filters</dt>
                    <dd>{Object.keys(answer.explainability.filters).length ? JSON.stringify(answer.explainability.filters) : "none"}</dd>
                    <dt>Query plan</dt>
                    <dd>{answer.explainability.queryPlan.join(" -> ")}</dd>
                    <dt>Rows</dt>
                    <dd>{answer.explainability.sourceRows}</dd>
                  </dl>
                </div>
              )}
            </aside>
          </section>
        </>
      )}
    </main>
  );
}
