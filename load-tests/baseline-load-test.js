/**
 * BriVox Baseline Load Testing Suite
 * File: load-tests/baseline-load-test.js
 * 
 * Simulates 100 concurrent Virtual Users (VUs) running continuously for 1 minute (60 seconds).
 * Measures Requests Per Second (RPS), Response Latency (Min, Max, Average, p95, p99),
 * and status code distribution.
 */

import http from 'http';
import https from 'https';

// Load Test Configuration
const TARGET_URL = process.env.LOAD_TARGET_URL || 'http://localhost:5173';
const CONCURRENT_VUS = parseInt(process.env.LOAD_VUS || '100', 10);
const DURATION_SECONDS = parseInt(process.env.LOAD_DURATION_SEC || '60', 10);
const TARGET_ENDPOINTS = ['/', '/index.html', '/src/styles.css', '/api/run'];

export async function runBaselineLoadTest({
  url = TARGET_URL,
  vus = CONCURRENT_VUS,
  durationSec = DURATION_SECONDS,
  endpoints = TARGET_ENDPOINTS,
} = {}) {
  console.log(`\n==================================================`);
  console.log(`⚡ BriVox Baseline Load Testing`);
  console.log(`Target: ${url}`);
  console.log(`Virtual Users: ${vus} concurrent workers`);
  console.log(`Duration: ${durationSec} seconds continuous`);
  console.log(`==================================================\n`);

  const startTime = Date.now();
  const endTime = startTime + durationSec * 1000;
  const latencies = [];
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;
  const statusCodes = {};
  const perSecondBuckets = {};

  // Custom HTTP Agent with Keep-Alive for load testing
  const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 200 });
  const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 200 });

  // Virtual User worker function
  async function virtualUser(vuId) {
    let endpointIdx = vuId % endpoints.length;

    while (Date.now() < endTime) {
      const ep = endpoints[endpointIdx % endpoints.length];
      endpointIdx++;
      const fullUrl = `${url}${ep}`;
      const reqStart = Date.now();

      try {
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'User-Agent': `BriVoxLoadTester/1.0 (VU ${vuId})`,
            'Accept': 'text/html,application/json,*/*',
          },
          // Connect to dev server or mock endpoint
          agent: fullUrl.startsWith('https') ? httpsAgent : httpAgent,
        }).catch((err) => ({ status: 0, error: err }));

        const latency = Date.now() - reqStart;
        const secondBucket = Math.floor((reqStart - startTime) / 1000);

        latencies.push(latency);
        totalRequests++;

        const code = response.status || 0;
        statusCodes[code] = (statusCodes[code] || 0) + 1;

        if (code >= 200 && code < 400) {
          successfulRequests++;
        } else {
          failedRequests++;
        }

        if (!perSecondBuckets[secondBucket]) {
          perSecondBuckets[secondBucket] = { reqs: 0, latencies: [] };
        }
        perSecondBuckets[secondBucket].reqs++;
        perSecondBuckets[secondBucket].latencies.push(latency);

        // Minimal pacing delay between iterations (20ms to 50ms) to simulate realistic browser requests
        await new Promise((r) => setTimeout(r, Math.floor(20 + Math.random() * 30)));
      } catch (err) {
        failedRequests++;
        totalRequests++;
      }
    }
  }

  console.log(`Spawning ${vus} virtual users... Testing in progress...`);
  const vuPromises = [];
  for (let i = 0; i < vus; i++) {
    vuPromises.push(virtualUser(i));
  }

  // Monitor progress every 10 seconds
  const monitorInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const currentRps = (totalRequests / (elapsed || 1)).toFixed(1);
    console.log(`[T+${elapsed}s] Requests sent: ${totalRequests} | Current RPS: ${currentRps} req/sec`);
  }, 10000);

  await Promise.all(vuPromises);
  clearInterval(monitorInterval);

  const totalTimeSec = (Date.now() - startTime) / 1000;
  latencies.sort((a, b) => a - b);

  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const minLatency = latencies.length ? latencies[0] : 0;
  const maxLatency = latencies.length ? latencies[latencies.length - 1] : 0;
  const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.50)] : 0;
  const p90 = latencies.length ? latencies[Math.floor(latencies.length * 0.90)] : 0;
  const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const p99 = latencies.length ? latencies[Math.floor(latencies.length * 0.99)] : 0;
  const rps = (totalRequests / totalTimeSec).toFixed(1);

  console.log(`\n==================================================`);
  console.log(`🏁 Baseline Load Test Results Summary:`);
  console.log(`• Duration: ${totalTimeSec.toFixed(1)} seconds`);
  console.log(`• Virtual Users: ${vus}`);
  console.log(`• Total Requests Sent: ${totalRequests}`);
  console.log(`• Successful Requests: ${successfulRequests}`);
  console.log(`• Failed Requests: ${failedRequests}`);
  console.log(`• Requests Per Second (RPS): ${rps} req/sec`);
  console.log(`• Response Time Metrics:`);
  console.log(`   - Fastest / Min: ${minLatency} ms`);
  console.log(`   - Average:       ${avgLatency} ms`);
  console.log(`   - Slowest / Max: ${maxLatency} ms`);
  console.log(`   - 90th percentile (p90): ${p90} ms`);
  console.log(`   - 95th percentile (p95): ${p95} ms`);
  console.log(`   - 99th percentile (p99): ${p99} ms`);
  console.log(`==================================================\n`);

  return {
    vus,
    durationSec: totalTimeSec,
    totalRequests,
    successfulRequests,
    failedRequests,
    rps: parseFloat(rps),
    latency: {
      min: minLatency,
      avg: avgLatency,
      max: maxLatency,
      p50,
      p90,
      p95,
      p99,
    },
    statusCodes,
    perSecondBuckets,
  };
}

if (process.argv[1] && process.argv[1].endsWith('baseline-load-test.js')) {
  runBaselineLoadTest().catch(console.error);
}
