"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ChartSpec } from "@/lib/analytics/types";

const COLORS = ["#0f766e", "#2563eb", "#d97706", "#dc2626", "#64748b", "#7c3aed"];

export function ChartRenderer({ spec, height = 240 }: { spec: ChartSpec; height?: number }) {
  if (!spec.data.length) {
    return <div className="empty-chart">No matching data</div>;
  }

  if (spec.type === "table") {
    const columns = Object.keys(spec.data[0] ?? {});
    return (
      <div className="table-scroll chart-table">
        <table>
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {spec.data.map((row, index) => (
              <tr key={index}>{columns.map((column) => <td key={column}>{row[column]}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (spec.type === "pie") {
    const total = spec.data.reduce((sum, row) => sum + Number(row[spec.yKey ?? "orders"] ?? 0), 0);
    return (
      <div className="donut-chart" style={{ minHeight: height }}>
        <div className="donut-visual">
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={spec.data}
                dataKey={spec.yKey ?? "orders"}
                nameKey={spec.xKey ?? "name"}
                innerRadius="58%"
                outerRadius="86%"
                paddingAngle={1}
                stroke="#fff"
                strokeWidth={2}
              >
                {spec.data.map((row, index) => (
                  <Cell key={String(row[spec.xKey ?? "name"])} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <strong>{total.toLocaleString()}</strong>
            <span>Total Orders</span>
          </div>
        </div>
        <div className="donut-legend">
          {spec.data.map((row, index) => {
            const label = String(row[spec.xKey ?? "name"]);
            const value = Number(row[spec.yKey ?? "orders"] ?? 0);
            const pct = total ? Math.round((value / total) * 1000) / 10 : 0;
            return (
              <div key={label}>
                <span><i style={{ background: COLORS[index % COLORS.length] }} />{label}</span>
                <strong>{value.toLocaleString()} ({pct}%)</strong>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (spec.type === "line") {
    if (spec.colorKey) {
      const xKey = spec.xKey ?? "month";
      const yKey = spec.yKey ?? "value";
      const colorKey = spec.colorKey;
      const seriesNames = [...new Set(spec.data.map((row) => String(row[colorKey])))];
      const rows = [...spec.data.reduce((map, row) => {
        const x = String(row[xKey]);
        const current = map.get(x) ?? { [xKey]: x };
        current[String(row[colorKey])] = row[yKey];
        map.set(x, current);
        return map;
      }, new Map<string, Record<string, string | number>>()).values()];

      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={rows} margin={{ top: 12, right: 10, left: -18, bottom: 4 }}>
            <CartesianGrid stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {seriesNames.map((series, index) => (
              <Line key={series} type="monotone" dataKey={series} stroke={COLORS[index % COLORS.length]} strokeWidth={2.5} connectNulls dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={spec.data} margin={{ top: 12, right: 10, left: -18, bottom: 4 }}>
          <CartesianGrid stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey={spec.xKey} tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip />
          <Line type="monotone" dataKey={spec.yKey ?? "orders"} stroke="#0f766e" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={spec.data} margin={{ top: 12, right: 10, left: -18, bottom: 4 }}>
        <CartesianGrid stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey={spec.xKey} tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <Tooltip />
        <Bar dataKey={spec.yKey ?? "orders"} fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
