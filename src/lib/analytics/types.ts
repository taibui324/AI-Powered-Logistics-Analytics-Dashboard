export type LogisticsOrder = {
  clientId: string;
  orderId: string;
  orderDate: string;
  deliveryDate: string | null;
  carrier: string;
  originCity: string;
  destinationCity: string;
  status: "delivered" | "delayed" | "in_transit" | "exception" | "canceled";
  sku: string;
  productCategory: string;
  quantity: number;
  unitPriceUsd: number;
  orderValueUsd: number;
  isPromo: boolean;
  promoDiscountPct: number;
  region: string;
  warehouse: string;
};

export type DashboardFilters = {
  from?: string;
  to?: string;
  carrier?: string;
  region?: string;
  warehouse?: string;
  productCategory?: string;
  sku?: string;
};

export type ChartSpec = {
  type: "line" | "bar" | "pie" | "table";
  title: string;
  xKey?: string;
  yKey?: string;
  colorKey?: string;
  data: Record<string, string | number>[];
};

export type Explainability = {
  filters: DashboardFilters;
  metrics: string[];
  dimensions: string[];
  timeGrain?: string;
  interpretation: string;
  queryPlan: string[];
  methodology: string;
  sourceRows: number;
};

export type DashboardSummary = {
  kpis: {
    totalOrders: number;
    deliveredOrders: number;
    delayedOrders: number;
    onTimeRate: number;
    averageDeliveryDays: number;
    revenue: number;
  };
  filters: DashboardFilters;
  facets: Record<"carrier" | "region" | "warehouse" | "productCategory", string[]>;
  charts: {
    orderVolume: ChartSpec;
    statusSplit: ChartSpec;
    carrierDelayRate: ChartSpec;
    regionBreakdown: ChartSpec;
  };
  tablePreview: LogisticsOrder[];
  explainability: Explainability;
};

export type AnalystAnswer = {
  mode: "deterministic" | "openai";
  question: string;
  answer: string;
  intent: {
    tool: "analytics_query" | "forecast" | "unsupported";
    metric: string;
    dimensions: string[];
    chart: ChartSpec["type"];
  };
  chart: ChartSpec;
  table: Record<string, string | number>[];
  explainability: Explainability;
  explanation: Explainability;
  recommendation?: string;
  unsupportedReason?: string;
};
