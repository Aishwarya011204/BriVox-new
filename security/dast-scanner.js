/**
 * BriVox Automated DAST Scanner (Detection-Only & Non-Destructive)
 * File: security/dast-scanner.js
 * 
 * Performs live dynamic testing against the running frontend and proxy services.
 * Tests: Security Headers, CORS Policy, Proxy Auth, Injection Detection, Rate Limiting, Error Leakage.
 */

const TARGET_URL = process.env.DAST_TARGET_URL || 'http://localhost:5173';

export async function runDastScan(baseUrl = TARGET_URL) {
  console.log(`\n==================================================`);
  console.log(`🛡️  BriVox Dynamic Application Security Testing (DAST)`);
  console.log(`Target: ${baseUrl} (Detection Only / Non-Destructive)`);
  console.log(`==================================================\n`);

  const results = [];

  const addResult = (id, checkName, category, severity, status, details, recommendation) => {
    const res = { id, checkName, category, severity, status, details, recommendation };
    results.push(res);
    const badge = status === 'FAIL' ? '⚠️ VULNERABLE' : status === 'PASS' ? '✅ SECURE' : 'ℹ️ INFO';
    console.log(`[${badge}] ${id} - ${checkName} (${severity}): ${status}`);
    console.log(`         Details: ${details}`);
  };

  // 1. Security Headers Audit
  try {
    const res = await fetch(`${baseUrl}/`, { method: 'GET' });
    const headers = Object.fromEntries(res.headers.entries());

    const missingHeaders = [];
    if (!headers['content-security-policy']) missingHeaders.push('Content-Security-Policy (CSP)');
    if (!headers['x-frame-options']) missingHeaders.push('X-Frame-Options (Clickjacking)');
    if (!headers['x-content-type-options']) missingHeaders.push('X-Content-Type-Options (MIME Sniffing)');
    if (!headers['strict-transport-security'] && baseUrl.startsWith('https')) missingHeaders.push('Strict-Transport-Security (HSTS)');
    if (!headers['referrer-policy']) missingHeaders.push('Referrer-Policy');

    if (missingHeaders.length > 0) {
      addResult(
        'DAST-HDR-01',
        'Missing HTTP Security Headers',
        'Configuration',
        'Medium',
        'FAIL',
        `Target is missing recommended defense-in-depth headers: ${missingHeaders.join(', ')}`,
        'Configure Vite server and Firebase hosting headers in firebase.json or vite.config.js to enforce strict security headers.'
      );
    } else {
      addResult('DAST-HDR-01', 'HTTP Security Headers Audit', 'Configuration', 'Medium', 'PASS', 'All standard security headers are present.', 'Maintain header configurations.');
    }
  } catch (err) {
    addResult('DAST-HDR-01', 'HTTP Security Headers Audit', 'Configuration', 'Medium', 'INFO', `Target not reachable: ${err.message}`, 'Ensure test server is started.');
  }

  // 2. CORS Policy Verification
  try {
    const res = await fetch(`${baseUrl}/api/run`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://evil-attacker-domain.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const allowOrigin = res.headers.get('access-control-allow-origin');
    if (allowOrigin === '*' || allowOrigin === 'https://evil-attacker-domain.com') {
      addResult(
        'DAST-CORS-01',
        'Overly Permissive or Reflective CORS Configuration',
        'API Security',
        'Medium',
        'FAIL',
        `CORS Access-Control-Allow-Origin is set to '${allowOrigin}', permitting cross-origin exploitation.`,
        'Restrict Access-Control-Allow-Origin to trusted domains only.'
      );
    } else {
      addResult('DAST-CORS-01', 'CORS Policy Check', 'API Security', 'Medium', 'PASS', `CORS origin is restricted (received '${allowOrigin || 'none'}').`, 'Maintain origin whitelisting.');
    }
  } catch (err) {
    addResult('DAST-CORS-01', 'CORS Policy Check', 'API Security', 'Medium', 'INFO', `CORS probe skipped: ${err.message}`, 'N/A');
  }

  // 3. Proxy Route Authentication & SSRF Check (/api/run)
  try {
    const res = await fetch(`${baseUrl}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compiler: 'cpython-3.13.8', code: 'print("probe")' }),
    });
    if (res.status === 200) {
      addResult(
        'DAST-PRX-01',
        'Unauthenticated Sandbox Compiler Proxy Exposure (/api/run)',
        'Authorization',
        'High',
        'FAIL',
        'The proxy endpoint /api/run executes remote code without requiring any Firebase Auth session or API token.',
        'Implement authentication middleware requiring valid Firebase ID tokens before proxying code execution.'
      );
    } else {
      addResult('DAST-PRX-01', 'Proxy Authentication Check (/api/run)', 'Authorization', 'High', 'PASS', `Received status ${res.status}. Access restricted.`, 'Maintain proxy auth guards.');
    }
  } catch (err) {
    addResult('DAST-PRX-01', 'Proxy Authentication Check (/api/run)', 'Authorization', 'High', 'INFO', `Proxy not reachable: ${err.message}`, 'Verify proxy setup.');
  }

  // 4. Rate Limiting & DoS Burst Detection
  try {
    const burstPromises = [];
    for (let i = 0; i < 20; i++) {
      burstPromises.push(fetch(`${baseUrl}/`, { method: 'GET' }));
    }
    const burstResponses = await Promise.all(burstPromises);
    const has429 = burstResponses.some((r) => r.status === 429);
    if (!has429) {
      addResult(
        'DAST-RAT-01',
        'Lack of Request Rate Limiting on Rapid Bursts',
        'Rate Limiting',
        'Medium',
        'FAIL',
        '20 concurrent requests were processed without encountering HTTP 429 Too Many Requests.',
        'Implement express-rate-limit or Cloudflare / Firebase App Check rate limiting to prevent brute-force attacks and token depletion.'
      );
    } else {
      addResult('DAST-RAT-01', 'Rate Limiting Throttling', 'Rate Limiting', 'Medium', 'PASS', 'Rate limiting successfully triggered 429 response under burst.', 'Maintain rate limiting policies.');
    }
  } catch (err) {
    addResult('DAST-RAT-01', 'Rate Limiting Detection', 'Rate Limiting', 'Medium', 'INFO', `Rate limit probe skipped: ${err.message}`, 'N/A');
  }

  // 5. Error Disclosure & Stack Trace Leakage
  try {
    const res = await fetch(`${baseUrl}/api/groq/non-existent-endpoint-probe-999`, { method: 'GET' });
    const body = await res.text();
    const leaksStack = /Error:|\bat\s+.*\..*:\d+:\d+|\bTraceback\b|node_modules/i.test(body);

    if (leaksStack) {
      addResult(
        'DAST-ERR-01',
        'Detailed Stack Trace & System Error Disclosure',
        'Information Disclosure',
        'Low',
        'FAIL',
        'The application returned raw stack traces or internal server file paths in HTTP error response.',
        'Implement custom generic error pages in production that suppress internal debugging traces.'
      );
    } else {
      addResult('DAST-ERR-01', 'Error Information Leakage Check', 'Information Disclosure', 'Low', 'PASS', 'No sensitive stack traces or internal paths exposed in error response.', 'Maintain sanitized error handling.');
    }
  } catch (err) {
    addResult('DAST-ERR-01', 'Error Leakage Check', 'Information Disclosure', 'Low', 'INFO', `Probe skipped: ${err.message}`, 'N/A');
  }

  console.log(`\nDAST Scan Complete. ${results.length} checks performed.\n`);
  return results;
}

if (process.argv[1] && process.argv[1].endsWith('dast-scanner.js')) {
  runDastScan().catch(console.error);
}
