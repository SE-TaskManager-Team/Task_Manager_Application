

const { performance } = require('node:perf_hooks');

const url = process.env.PERF_URL;
const token = process.env.PERF_TOKEN;
const totalRequests = Number(process.env.PERF_REQUESTS || 100);
const concurrency = Number(process.env.PERF_CONCURRENCY || 10);
const thresholdMs = 3000;

if (
  !url ||
  !Number.isInteger(totalRequests) ||
  totalRequests < 1 ||
  !Number.isInteger(concurrency) ||
  concurrency < 1
) {
  console.error(
    'Set PERF_URL and valid PERF_REQUESTS/PERF_CONCURRENCY values.'
  );
  process.exit(1);
}

async function measureRequest() {
  const start = performance.now();

  try {
    const response = await fetch(url, {
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {},
      signal: AbortSignal.timeout(15000)
    });

    await response.arrayBuffer();

    return {
      duration: performance.now() - start,
      ok: response.ok
    };
  } catch (error) {
    return {
      duration: performance.now() - start,
      ok: false,
      error: error.message
    };
  }
}

async function main() {
  const results = [];

  for (let i = 0; i < totalRequests; i += concurrency) {
    const batchSize = Math.min(
      concurrency,
      totalRequests - i
    );

    const batch = await Promise.all(
      Array.from(
        { length: batchSize },
        () => measureRequest()
      )
    );

    results.push(...batch);
  }

  const durations = results
    .map(result => result.duration)
    .sort((a, b) => a - b);

  const withinThreshold = results.filter(
    result => result.ok && result.duration <= thresholdMs
  ).length;

  const successful = results.filter(
    result => result.ok
  ).length;

  const p90Index = Math.max(
    0,
    Math.ceil(durations.length * 0.90) - 1
  );

  const p90 = durations[p90Index];
  const passRate = (withinThreshold / totalRequests) * 100;

  console.log('\nPerformance test results');
  console.log('------------------------');
  console.log(`URL: ${url}`);
  console.log(`Requests: ${totalRequests}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(
    `Successful HTTP responses: ${successful}/${totalRequests}`
  );
  console.log(
    `Requests within 3 seconds: ${withinThreshold}/${totalRequests}`
  );
  console.log(`Pass rate: ${passRate.toFixed(2)}%`);
  console.log(`P90 response time: ${p90.toFixed(2)} ms`);

  if (passRate < 90) {
    console.error(
      '\nFAIL: Fewer than 90% of requests met the target.'
    );
    process.exitCode = 1;
  } else {
    console.log(
      '\nPASS: The response-time threshold was met.'
    );
  }
}

main().catch(error => {
  console.error('Performance test failed:', error);
  process.exitCode = 1;
});
