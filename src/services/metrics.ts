type RouteMetric = {
  count: number;
  failures: number;
  totalDurationMs: number;
};

const routeMetrics = new Map<string, RouteMetric>();

function keyFor(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

export function recordHttpMetric(input: { method: string; path: string; statusCode: number; durationMs: number }): void {
  const key = keyFor(input.method, input.path);
  const metric = routeMetrics.get(key) ?? { count: 0, failures: 0, totalDurationMs: 0 };
  metric.count += 1;
  metric.totalDurationMs += input.durationMs;
  if (input.statusCode >= 400) {
    metric.failures += 1;
  }
  routeMetrics.set(key, metric);
}

export function getMetricsSnapshot(): {
  routes: Array<{
    route: string;
    count: number;
    failures: number;
    avgDurationMs: number;
  }>;
} {
  return {
    routes: [...routeMetrics.entries()].map(([route, metric]) => ({
      route,
      count: metric.count,
      failures: metric.failures,
      avgDurationMs: metric.count > 0 ? Number((metric.totalDurationMs / metric.count).toFixed(2)) : 0
    }))
  };
}

export function getMetricsSummary(): {
  totalRequests: number;
  totalFailures: number;
  errorRate: number;
} {
  let totalRequests = 0;
  let totalFailures = 0;

  for (const metric of routeMetrics.values()) {
    totalRequests += metric.count;
    totalFailures += metric.failures;
  }

  return {
    totalRequests,
    totalFailures,
    errorRate: totalRequests === 0 ? 0 : Number((totalFailures / totalRequests).toFixed(4))
  };
}
