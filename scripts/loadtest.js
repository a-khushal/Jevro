const autocannon = require("autocannon");

const url = process.env.LOADTEST_URL || "http://127.0.0.1:8080/health";
const duration = Number(process.env.LOADTEST_DURATION_SECONDS || 10);
const connections = Number(process.env.LOADTEST_CONNECTIONS || 25);
const p95ThresholdMs = Number(process.env.LOADTEST_P95_THRESHOLD_MS || 150);
const p99ThresholdMs = Number(process.env.LOADTEST_P99_THRESHOLD_MS || 250);

function run() {
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url,
      method: "GET",
      duration,
      connections,
      pipelining: 1
    });

    autocannon.track(instance, { renderProgressBar: true, renderResultsTable: true });

    instance.on("done", (result) => {
      const p95 = result.latency.p95;
      const p99 = result.latency.p99;
      console.log(
        `Load test complete. p95=${p95}ms (threshold=${p95ThresholdMs}ms), p99=${p99}ms (threshold=${p99ThresholdMs}ms)`
      );

      if (p95 > p95ThresholdMs) {
        reject(new Error(`p95 latency threshold exceeded: ${p95}ms > ${p95ThresholdMs}ms`));
        return;
      }

      if (p99 > p99ThresholdMs) {
        reject(new Error(`p99 latency threshold exceeded: ${p99}ms > ${p99ThresholdMs}ms`));
        return;
      }

      resolve(result);
    });

    instance.on("error", reject);
  });
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
