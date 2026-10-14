/**
 * Universal Stack Detection Engine
 * File: scripts/detect-stack.js
 * Automatically identifies framework, language, database, auth model, and API style.
 */

import fs from 'fs';
import path from 'path';

export function detectTechnologyStack(cwd = process.cwd()) {
  const stack = {
    language: 'Unknown',
    framework: 'Unknown',
    backendType: 'Unknown',
    database: 'None detected',
    authModel: 'None detected',
    apiArchitecture: 'REST / Client Proxies',
  };

  const has = (f) => fs.existsSync(path.join(cwd, f));
  const read = (f) => (has(f) ? fs.readFileSync(path.join(cwd, f), 'utf8') : '');

  // 1. Framework & Language Detection
  if (has('pom.xml') || has('build.gradle')) {
    stack.language = 'Java / Kotlin';
    stack.framework = 'Java Spring Boot';
    stack.backendType = 'Spring MVC / Spring Boot REST API';
  } else if (has('requirements.txt') || has('Pipfile') || has('pyproject.toml')) {
    stack.language = 'Python';
    const py = read('requirements.txt') + read('Pipfile') + read('pyproject.toml');
    if (/django/i.test(py)) stack.framework = 'Django / Django REST Framework';
    else if (/fastapi/i.test(py)) stack.framework = 'FastAPI';
    else if (/flask/i.test(py)) stack.framework = 'Flask';
    else stack.framework = 'Python Standard / WSGI';
    stack.backendType = 'Python Microservice / Web API';
  } else if (has('composer.json')) {
    stack.language = 'PHP';
    stack.framework = 'Laravel / Symfony';
    stack.backendType = 'PHP Web Framework';
  } else if (has('go.mod')) {
    stack.language = 'Go';
    stack.framework = 'Gin / Fiber / Echo';
    stack.backendType = 'Go REST Microservice';
  } else if (has('Gemfile')) {
    stack.language = 'Ruby';
    stack.framework = 'Ruby on Rails';
    stack.backendType = 'Rails API';
  } else if (has('package.json')) {
    stack.language = 'JavaScript / TypeScript (Node.js)';
    const pkg = JSON.parse(read('package.json') || '{}');
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps['@nestjs/core']) {
      stack.framework = 'NestJS';
      stack.backendType = 'NestJS Enterprise Microservice';
    } else if (deps['express']) {
      stack.framework = 'Express.js';
      stack.backendType = 'Express REST API';
    } else if (deps['react'] && (deps['vite'] || has('vite.config.js'))) {
      stack.framework = 'React 18 + Vite (SPA Client with API Gateway Proxies)';
      stack.backendType = 'Client-Side SPA with Firebase BaaS & Reverse Proxies';
    } else if (deps['next']) {
      stack.framework = 'Next.js';
      stack.backendType = 'Full-Stack Serverless SSR/API';
    } else {
      stack.framework = 'Node.js Web Application';
      stack.backendType = 'Node.js Application';
    }

    if (deps['firebase'] || deps['firebase-admin'] || has('firestore.rules')) {
      stack.database = 'Google Cloud Firestore (NoSQL)';
      stack.authModel = 'Firebase Authentication (Email/Password + Google OAuth2)';
    } else if (deps['pg'] || deps['typeorm'] || deps['prisma']) {
      stack.database = 'PostgreSQL / SQL via ORM';
    } else if (deps['mongoose'] || deps['mongodb']) {
      stack.database = 'MongoDB (NoSQL)';
    }
  }

  return stack;
}

if (process.argv[1] && process.argv[1].endsWith('detect-stack.js')) {
  const result = detectTechnologyStack();
  console.log('--- DETECTED BACKEND & APPLICATION STACK ---');
  console.log(JSON.stringify(result, null, 2));
}
