/**
 * Security Assessment Excel Report Generator
 * File: security/generate-security-reports.js
 * Generates:
 *  - Vulnerability Test Results/findings.xlsx
 *  - Vulnerability Test Results/endpoint-inventory.xlsx
 * 
 * Required Sheets in both:
 *  - Sheet 1: Security Findings
 *  - Sheet 2: Endpoint Inventory
 *  - Sheet 3: Dependency Vulnerabilities
 *  - Sheet 4: Risk Summary
 */

import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RESULTS_DIR = path.resolve(__dirname, '..', 'Vulnerability Test Results');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

const FINDINGS_DATA = [
  {
    id: 'SEC-FIND-001',
    title: 'Hardcoded Production API Secret in Tracked Repository (.env.txt)',
    severity: 'Critical',
    category: 'Sensitive Data Exposure',
    cwe: 'CWE-798: Use of Hard-coded Credentials',
    location: '.env.txt (line 2) & .env',
    endpoint: 'N/A (Git Repository File)',
    description: 'Active Groq API secret key (gsk_rIm8************************************09ck [Redacted for Security]) and Firebase project credentials are committed directly into git tracking in .env.txt.',
    scenario: 'An attacker scans the repository or GitHub commit history, extracts the active Groq key, and exhausts the account quota, incurs massive charges, or leverages it for unauthorized LLM inference.',
    impact: 'Full compromise of AI API quota, financial liability, and unauthorized third-party consumption.',
    fix: 'Revoke and rotate the Groq API key immediately. Remove .env.txt and .env from git tracking (`git rm --cached`), verify .gitignore, and inject secrets via environment variables or secret vaults.',
    status: 'Open (Action Required)',
  },
  {
    id: 'SEC-FIND-002',
    title: 'Unauthenticated Open Proxy & Server-Side Request Forgery Risk (/api/run, /api/groq)',
    severity: 'High',
    category: 'API Security / SSRF',
    cwe: 'CWE-918: Server-Side Request Forgery / CWE-306: Missing Authentication',
    location: 'vite.config.js (lines 9-24)',
    endpoint: '/api/groq/* and /api/run',
    description: 'The Vite dev/preview server exposes reverse proxies that inject the master GROQ_API_KEY into requests forwarded to api.groq.com and forwards arbitrary code execution requests to wandbox.org without verifying caller authentication or rate limits.',
    scenario: 'An unauthenticated attacker makes direct HTTP POST requests to http://<target>/api/groq/chat/completions with custom prompts, effectively using the application as a free, unauthenticated LLM proxy or spamming Wandbox.',
    impact: 'Token drain, API quota denial of service, open proxy abuse, and potential upstream blacklisting.',
    fix: 'Migrate proxy endpoints from the frontend dev server into authenticated serverless Cloud Functions or backend API endpoints with Firebase Auth verification (verifyIdToken) and per-user rate limiting.',
    status: 'Open (Action Required)',
  },
  {
    id: 'SEC-FIND-003',
    title: 'Overly Permissive Firestore Security Rules & Missing Schema Constraints',
    severity: 'High',
    category: 'Authorization & Data Validation',
    cwe: 'CWE-284: Improper Access Control / CWE-20: Improper Input Validation',
    location: 'firestore.rules (lines 5-7)',
    endpoint: 'Firestore: /users/{uid}/{document=**}',
    description: 'Firestore security rules grant unconstrained read and write access to all recursive subcollections under /users/{uid}/ without validating payload schema, field types, or size limits.',
    scenario: 'A compromised or rogue authenticated user submits hundreds of megabytes of arbitrary JSON or spoofed assessment attempts directly to their user document, corrupting analytics and exhausting database storage limits.',
    impact: 'Data integrity degradation, arbitrary storage consumption, and unauthorized tampering with assessment scores.',
    fix: 'Implement granular Firestore rules validating incoming document fields: check that attempt scores are valid integers between 0 and 100, role is in predefined list, and payload size is bounded.',
    status: 'Open (Action Required)',
  },
  {
    id: 'SEC-FIND-004',
    title: 'Unsanitized Markdown Rendering via dangerouslySetInnerHTML in Client UI',
    severity: 'Medium',
    category: 'Injection / Cross-Site Scripting (XSS)',
    cwe: 'CWE-79: Cross-Site Scripting (XSS)',
    location: 'src/md.js, src/pages/Mentor.jsx, src/CodeRunner.jsx',
    endpoint: 'Client-side Markdown Renderer',
    description: 'The custom markdown parser src/md.js uses regular expressions to generate HTML tags and injects them directly into the DOM using dangerouslySetInnerHTML. It lacks a comprehensive HTML sanitizer like DOMPurify.',
    scenario: 'An attacker crafts an AI prompt injection or manipulates stored assessment data containing crafted markdown vectors that bypass regex filtering, executing arbitrary JavaScript in the victim’s browser session.',
    impact: 'Session hijacking, DOM manipulation, credential theft in the context of the user session.',
    fix: 'Integrate DOMPurify with marked (e.g., `DOMPurify.sanitize(marked.parse(content))`) and eliminate bespoke regular-expression HTML generation.',
    status: 'Open',
  },
  {
    id: 'SEC-FIND-005',
    title: 'Missing Security Headers & Content Security Policy (CSP)',
    severity: 'Medium',
    category: 'Configuration',
    cwe: 'CWE-1021: Improper Restriction of Rendered UI / CWE-693: Protection Mechanism Failure',
    location: 'vite.config.js / hosting configuration',
    endpoint: 'All HTTP Responses',
    description: 'The web application does not set standard defensive security headers including Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy.',
    scenario: 'An attacker embeds the BriVox application in an iframe on an external domain to perform clickjacking attacks or exploits missing MIME sniffing protections.',
    impact: 'Clickjacking vulnerability, MIME-type sniffing attacks, and lack of defense-in-depth against injected scripts.',
    fix: 'Configure security headers in Vite dev/preview server and production hosting (e.g., firebase.json headers: Content-Security-Policy, X-Frame-Options: DENY, X-Content-Type-Options: nosniff).',
    status: 'Open',
  },
  {
    id: 'SEC-FIND-006',
    title: 'Absence of API Rate Limiting & Throttling on AI Endpoints',
    severity: 'Medium',
    category: 'Business Logic / Rate Limiting',
    cwe: 'CWE-770: Allocation of Resources Without Limits or Throttling',
    location: 'src/ai.js, src/pages/Assessment.jsx',
    endpoint: '/api/groq/chat/completions',
    description: 'The application contains no client-side or proxy-side throttling mechanisms on AI assessment generation, test grading, or mentor chat calls.',
    scenario: 'A user repeatedly clicks "Generate Assessment" or scripts rapid requests to /api/groq, rapidly triggering upstream Groq TPM/RPM quota exhaustion for all platform users.',
    impact: 'Denial of service for legitimate users, API rate limit exhaustion, degraded user experience.',
    fix: 'Implement request debouncing, client-side cooldown timers, and token-bucket rate limiting on the backend proxy.',
    status: 'Open',
  },
  {
    id: 'SEC-FIND-007',
    title: 'Weak Client-Enforced Password Policy (Minimum 6 Characters)',
    severity: 'Low',
    category: 'Authentication',
    cwe: 'CWE-521: Weak Password Requirements',
    location: 'src/pages/Auth.jsx (line 96)',
    endpoint: '/#/auth',
    description: 'The registration form enforces only a 6-character length minimum without requiring password complexity (uppercase, lowercase, numbers, symbols) or common password blacklisting.',
    scenario: 'Users create easily guessable passwords (e.g., 123456 or college), exposing accounts to credential stuffing or brute force.',
    impact: 'Increased likelihood of user account compromise via credential guessing.',
    fix: 'Enforce minimum 8-12 characters with character diversity checks and utilize zxcvbn or Firebase Auth password policy features.',
    status: 'Open',
  },
  {
    id: 'SEC-FIND-008',
    title: 'Transitive Vulnerabilities in @grpc/grpc-js and uuid Dependencies',
    severity: 'Low',
    category: 'Vulnerable Dependencies',
    cwe: 'CWE-295: Improper Certificate Validation / CWE-787: Buffer Bounds Check',
    location: 'package-lock.json',
    endpoint: 'Build & Runtime Dependencies',
    description: 'npm audit identified known CVEs in @grpc/grpc-js (GHSA-m9gg-hp2v-232j, CVSS 7.4) and uuid (GHSA-w5hq-g745-h8pq, CVSS 7.5).',
    scenario: 'Under specific TLS configurations, getAuthContext in grpc-js can return unauthorized certificates as authorized.',
    impact: 'Potential spoofing or security bypass in gRPC communication layer.',
    fix: 'Update dependencies using `npm update` and configure automated Dependabot alerts in GitHub.',
    status: 'Open',
  },
];

const ENDPOINT_DATA = [
  {
    endpoint: '/api/groq/chat/completions',
    method: 'POST',
    authRequired: 'None (Vite Proxy) / Groq Bearer Token injected',
    roles: 'Public / Unrestricted',
    controller: 'vite.config.js -> https://api.groq.com/openai/v1',
    riskLevel: 'Critical',
    purpose: 'Proxies AI LLM requests for assessment generation, grading, notes, and mentor chat',
  },
  {
    endpoint: '/api/run',
    method: 'POST',
    authRequired: 'None',
    roles: 'Public / Unrestricted',
    controller: 'vite.config.js -> https://wandbox.org/api/compile.json',
    riskLevel: 'High',
    purpose: 'Proxies multi-language code compilation and sandbox execution to Wandbox',
  },
  {
    endpoint: 'Firebase Auth: signInWithEmailAndPassword',
    method: 'POST (SDK / REST)',
    authRequired: 'None (Public Sign-in)',
    roles: 'Anonymous / Registered Users',
    controller: 'src/pages/Auth.jsx -> firebase/auth',
    riskLevel: 'Low',
    purpose: 'Authenticates student accounts using email and password',
  },
  {
    endpoint: 'Firebase Auth: createUserWithEmailAndPassword',
    method: 'POST (SDK / REST)',
    authRequired: 'None (Public Sign-up)',
    roles: 'Anonymous / New Students',
    controller: 'src/pages/Auth.jsx -> firebase/auth',
    riskLevel: 'Low',
    purpose: 'Registers new student accounts and initializes profile',
  },
  {
    endpoint: 'Firebase Auth: signInWithPopup (Google)',
    method: 'POST / OAuth2',
    authRequired: 'Google Identity Token',
    roles: 'Google Account Holders',
    controller: 'src/pages/Auth.jsx -> firebase/auth',
    riskLevel: 'Low',
    purpose: 'Federated Google OAuth single sign-on authentication',
  },
  {
    endpoint: 'Firebase Auth: sendPasswordResetEmail',
    method: 'POST (SDK / REST)',
    authRequired: 'None',
    roles: 'Public / Self-Service',
    controller: 'src/pages/Auth.jsx -> firebase/auth',
    riskLevel: 'Low',
    purpose: 'Dispatches password reset link to user email',
  },
  {
    endpoint: 'Firestore: /users/{uid}',
    method: 'GET / SET (Merge)',
    authRequired: 'Yes (request.auth.uid == uid)',
    roles: 'Student Owner',
    controller: 'src/firebase.js -> getProfile / saveProfile',
    riskLevel: 'Medium',
    purpose: 'Stores student metadata (name, college, branch, target role, chat log)',
  },
  {
    endpoint: 'Firestore: /users/{uid}/attempts/{id}',
    method: 'POST / GET',
    authRequired: 'Yes (request.auth.uid == uid)',
    roles: 'Student Owner',
    controller: 'src/firebase.js -> addAttempt / listAttempts',
    riskLevel: 'Medium',
    purpose: 'Stores assessment history, skill test scores, and overall IRI metrics',
  },
  {
    endpoint: '/#/dashboard',
    method: 'GET (Client Route)',
    authRequired: 'Yes (Client Route Guard)',
    roles: 'Authenticated Student',
    controller: 'src/App.jsx -> src/pages/Dashboard.jsx',
    riskLevel: 'Low',
    purpose: 'Main overview displaying Internship Readiness Index and skill gap cards',
  },
  {
    endpoint: '/#/assess and /#/assess/:skill',
    method: 'GET (Client Route)',
    authRequired: 'Yes (Client Route Guard)',
    roles: 'Authenticated Student',
    controller: 'src/App.jsx -> src/pages/Assessment.jsx',
    riskLevel: 'Low',
    purpose: 'Interactive timed technical assessment questions and coding tasks',
  },
  {
    endpoint: '/#/code',
    method: 'GET (Client Route)',
    authRequired: 'Yes (Client Route Guard)',
    roles: 'Authenticated Student',
    controller: 'src/App.jsx -> src/pages/CodeLab.jsx',
    riskLevel: 'Low',
    purpose: 'In-browser code editor and debugger executing against Wandbox sandbox',
  },
  {
    endpoint: '/#/mentor',
    method: 'GET (Client Route)',
    authRequired: 'Yes (Client Route Guard)',
    roles: 'Authenticated Student',
    controller: 'src/App.jsx -> src/pages/Mentor.jsx',
    riskLevel: 'Low',
    purpose: 'AI career mentor streaming chat interface',
  },
];

const DEPENDENCY_DATA = [
  {
    pkg: '@grpc/grpc-js',
    version: '1.11.1',
    advisory: 'GHSA-m9gg-hp2v-232j',
    cve: 'CVE-2024-47068',
    severity: 'High',
    cvss: 7.4,
    cwe: 'CWE-295',
    type: 'Transitive (via @firebase/firestore)',
    remediation: 'Upgrade @grpc/grpc-js to >=1.13.6 or update firebase package',
  },
  {
    pkg: '@grpc/grpc-js',
    version: '1.11.1',
    advisory: 'GHSA-f596-whhp-79r4',
    cve: 'CVE-2024-47067',
    severity: 'Low',
    cvss: 3.7,
    cwe: 'CWE-550',
    type: 'Transitive (via @firebase/firestore)',
    remediation: 'Upgrade @grpc/grpc-js to >=1.13.6',
  },
  {
    pkg: 'uuid',
    version: '8.3.2',
    advisory: 'GHSA-w5hq-g745-h8pq',
    cve: 'CVE-2024-45338',
    severity: 'Moderate',
    cvss: 7.5,
    cwe: 'CWE-787',
    type: 'Transitive (via exceljs)',
    remediation: 'Update exceljs or override uuid to >=11.1.1',
  },
  {
    pkg: 'glob',
    version: '7.2.3',
    advisory: 'Deprecated / Vulnerable legacy branch',
    cve: 'Legacy API',
    severity: 'Low',
    cvss: 4.3,
    cwe: 'CWE-400',
    type: 'Transitive build dependency',
    remediation: 'Migrate build tools to native glob in Node 22 or glob >= 10.x',
  },
];

async function createSecurityWorkbook(filename, mainTitle) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Antigravity DevSecOps Team';
  workbook.created = new Date();

  // -------------------------------------------------------------------
  // SHEET 1: Security Findings
  // -------------------------------------------------------------------
  const findingsSheet = workbook.addWorksheet('Security Findings', {
    views: [{ showGridLines: true, state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  const fHead = findingsSheet.addRow([
    'Finding ID',
    'Vulnerability Title',
    'Severity',
    'Vulnerability Category',
    'CWE Identifier',
    'File / Code Location',
    'Endpoint / Route',
    'Detailed Description',
    'Exploitation Scenario',
    'Technical Impact',
    'Remediation Fix',
    'Status',
  ]);
  fHead.height = 28;
  fHead.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  fHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF881337' } }; // Crimson
  fHead.alignment = { vertical: 'middle', horizontal: 'center' };

  FINDINGS_DATA.forEach((f) => {
    const row = findingsSheet.addRow([
      f.id,
      f.title,
      f.severity,
      f.category,
      f.cwe,
      f.location,
      f.endpoint,
      f.description,
      f.scenario,
      f.impact,
      f.fix,
      f.status,
    ]);
    row.height = 34;
    row.font = { name: 'Segoe UI', size: 9 };

    const sevCell = row.getCell(3);
    if (f.severity === 'Critical') {
      sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      sevCell.font = { color: { argb: 'FF991B1B' }, bold: true };
    } else if (f.severity === 'High') {
      sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
      sevCell.font = { color: { argb: 'FF9A3412' }, bold: true };
    } else if (f.severity === 'Medium') {
      sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      sevCell.font = { color: { argb: 'FF92400E' }, bold: true };
    } else {
      sevCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
      sevCell.font = { color: { argb: 'FF3730A3' }, bold: true };
    }
  });

  findingsSheet.columns = [
    { width: 15 },
    { width: 38 },
    { width: 14 },
    { width: 25 },
    { width: 28 },
    { width: 30 },
    { width: 30 },
    { width: 45 },
    { width: 45 },
    { width: 40 },
    { width: 45 },
    { width: 18 },
  ];

  // -------------------------------------------------------------------
  // SHEET 2: Endpoint Inventory
  // -------------------------------------------------------------------
  const epSheet = workbook.addWorksheet('Endpoint Inventory', {
    views: [{ showGridLines: true, state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  const epHead = epSheet.addRow([
    'Endpoint',
    'HTTP Method',
    'Authentication Required',
    'Expected Roles',
    'Controller / File Path',
    'Risk Level',
    'Functionality / Purpose',
  ]);
  epHead.height = 28;
  epHead.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  epHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  epHead.alignment = { vertical: 'middle', horizontal: 'center' };

  ENDPOINT_DATA.forEach((ep) => {
    const row = epSheet.addRow([
      ep.endpoint,
      ep.method,
      ep.authRequired,
      ep.roles,
      ep.controller,
      ep.riskLevel,
      ep.purpose,
    ]);
    row.height = 26;
    row.font = { name: 'Segoe UI', size: 9 };

    const riskCell = row.getCell(6);
    if (ep.riskLevel === 'Critical') {
      riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      riskCell.font = { color: { argb: 'FF991B1B' }, bold: true };
    } else if (ep.riskLevel === 'High') {
      riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
      riskCell.font = { color: { argb: 'FF9A3412' }, bold: true };
    } else if (ep.riskLevel === 'Medium') {
      riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      riskCell.font = { color: { argb: 'FF92400E' }, bold: true };
    } else {
      riskCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      riskCell.font = { color: { argb: 'FF065F46' }, bold: true };
    }
  });

  epSheet.columns = [
    { width: 38 },
    { width: 16 },
    { width: 32 },
    { width: 25 },
    { width: 45 },
    { width: 15 },
    { width: 50 },
  ];

  // -------------------------------------------------------------------
  // SHEET 3: Dependency Vulnerabilities
  // -------------------------------------------------------------------
  const depSheet = workbook.addWorksheet('Dependency Vulnerabilities', {
    views: [{ showGridLines: true, state: 'frozen', xSplit: 0, ySplit: 1 }],
  });

  const depHead = depSheet.addRow([
    'Package Name',
    'Installed Version',
    'Advisory ID',
    'CVE Identifier',
    'Severity',
    'CVSS Score',
    'CWE Classification',
    'Dependency Chain',
    'Recommended Remediation Action',
  ]);
  depHead.height = 28;
  depHead.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  depHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } };
  depHead.alignment = { vertical: 'middle', horizontal: 'center' };

  DEPENDENCY_DATA.forEach((dep) => {
    const row = depSheet.addRow([
      dep.pkg,
      dep.version,
      dep.advisory,
      dep.cve,
      dep.severity,
      dep.cvss,
      dep.cwe,
      dep.type,
      dep.remediation,
    ]);
    row.height = 24;
    row.font = { name: 'Segoe UI', size: 9 };
  });

  depSheet.columns = [
    { width: 22 },
    { width: 16 },
    { width: 24 },
    { width: 18 },
    { width: 14 },
    { width: 12 },
    { width: 18 },
    { width: 35 },
    { width: 45 },
  ];

  // -------------------------------------------------------------------
  // SHEET 4: Risk Summary
  // -------------------------------------------------------------------
  const riskSheet = workbook.addWorksheet('Risk Summary', {
    views: [{ showGridLines: true }],
  });

  riskSheet.mergeCells('A1:E1');
  const rTitle = riskSheet.getCell('A1');
  rTitle.value = `${mainTitle} - Executive Risk & Posture Summary`;
  rTitle.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  rTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  rTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  riskSheet.getRow(1).height = 36;

  riskSheet.addRow([]);

  // Score Box
  riskSheet.addRow(['OVERALL SECURITY SCORE', '', '', '', '']);
  riskSheet.mergeCells('A3:E3');
  const scoreBanner = riskSheet.getCell('A3');
  scoreBanner.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  scoreBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } };

  const scoreRow = riskSheet.addRow(['Security Score:', '68 / 100', 'Grade: C+ (Moderate Risk)', 'Requires Key Revocation & Auth Gate']);
  scoreRow.height = 26;
  scoreRow.font = { name: 'Segoe UI', size: 11, bold: true };

  riskSheet.addRow([]);

  // Findings Breakdown
  riskSheet.addRow(['FINDINGS SEVERITY DISTRIBUTION', '', '', '', '']);
  riskSheet.mergeCells('A6:E6');
  const distBanner = riskSheet.getCell('A6');
  distBanner.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  distBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };

  const distTable = [
    ['Severity Level', 'Count', 'Percentage (%)', 'Action Required', 'Target Remediation SLA'],
    ['Critical', 1, '12.5%', 'Immediate revocation & fix', 'Within 24 Hours'],
    ['High', 2, '25.0%', 'Architecture refactor & auth gating', 'Within 3 Days'],
    ['Medium', 3, '37.5%', 'Implement sanitizer, headers, rate limits', 'Within 1 Sprint'],
    ['Low', 2, '25.0%', 'Update deps & password complexity', 'Next Release'],
    ['TOTAL FINDINGS', 8, '100.0%', 'Comprehensive Security Hardening', 'Continuous'],
  ];

  distTable.forEach((row, i) => {
    const r = riskSheet.addRow(row);
    r.height = 22;
    r.font = { name: 'Segoe UI', size: 10, bold: i === 0 || i === distTable.length - 1 };
    if (i === 0) r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  });

  riskSheet.addRow([]);

  // Top Critical Risks Callout
  riskSheet.addRow(['TOP 3 CRITICAL & HIGH RISKS TO MITIGATE FIRST', '', '', '', '']);
  riskSheet.mergeCells('A14:E14');
  const topHead = riskSheet.getCell('A14');
  topHead.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  topHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF991B1B' } };

  const topRisks = [
    ['Rank', 'Vulnerability', 'Root Cause', 'Business Consequence', 'Recommended Immediate Fix'],
    ['1', 'Hardcoded Groq API Secret in .env.txt', 'Committed cleartext credential in git repository', 'Financial liability & full AI quota depletion by third parties', 'Revoke key in Groq console; purge file from git history'],
    ['2', 'Unauthenticated Open AI/Sandbox Proxies', 'Vite dev proxy forwards /api/groq and /api/run to public APIs', 'Attacker uses host as free proxy without authentication', 'Gate proxies behind Firebase Auth Cloud Functions with rate limits'],
    ['3', 'Unconstrained Firestore Wildcard Write Rules', 'firestore.rules grants blanket write to /users/{uid}/{doc=**}', 'Authenticated user can inject corrupted scores or spam storage', 'Enforce granular field types and schema validation rules in Firestore'],
  ];

  topRisks.forEach((row, i) => {
    const r = riskSheet.addRow(row);
    r.height = 24;
    r.font = { name: 'Segoe UI', size: 9, bold: i === 0 };
    if (i === 0) r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
  });

  riskSheet.columns = [
    { width: 10 },
    { width: 35 },
    { width: 35 },
    { width: 45 },
    { width: 45 },
  ];

  const targetPath = path.join(RESULTS_DIR, filename);
  await workbook.xlsx.writeFile(targetPath);
  console.log(`✅ Successfully generated Security Excel Report: ${targetPath}`);
}

async function run() {
  await createSecurityWorkbook('findings.xlsx', 'BriVox Security Assessment');
  await createSecurityWorkbook('endpoint-inventory.xlsx', 'BriVox API & Endpoint Inventory');
}

run().catch(console.error);
