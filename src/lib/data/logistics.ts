import { DashboardFilters } from "@/lib/analytics/types";
import { csvLogisticsRepository } from "./csvLogisticsRepository";
import { LogisticsRepository, shouldUsePostgres } from "./logisticsRepository";
import { createPostgresLogisticsRepository } from "./postgresLogisticsRepository";

let repository: LogisticsRepository | null = null;

export function getLogisticsRepository() {
  if (!repository) {
    repository = shouldUsePostgres() ? createPostgresLogisticsRepository() : csvLogisticsRepository;
  }
  return repository;
}

export function resetLogisticsRepositoryForTests() {
  repository = null;
}

export async function loadLogisticsOrders(filters: DashboardFilters = {}) {
  return getLogisticsRepository().listOrders(filters);
}
