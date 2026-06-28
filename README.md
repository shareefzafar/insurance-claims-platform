# InsureCo Claims Platform

A full-stack insurance claims platform built to demonstrate production-grade
software engineering across three projects — Java microservice, JavaScript
frontend, and a complete DevOps pipeline.

[![CI Pipeline](https://github.com/shareefzafar/insurance-claims-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/shareefzafar/insurance-claims-platform/actions/workflows/ci.yml)

---

## Projects

### Project 1 — claims-service (Java / Spring Boot)

REST microservice handling insurance claims lifecycle.

**Tech stack:** Java 21, Spring Boot 3.2, PostgreSQL, Flyway, OAuth2/JWT

**Demonstrates:**
- SOLID principles — every class has one responsibility, dependencies injected via interfaces
- Design patterns — Singleton (thread-safe), Strategy, Builder, Observer, Factory
- DRY — shared validation, single DTO mapping, centralised error handling
- Composition over Inheritance — `NotificationStrategy` and `ClaimProcessor` as injected interfaces
- Automated testing — JUnit 5, Mockito, Testcontainers (real PostgreSQL), @WebMvcTest
- DevSecOps — OWASP Dependency-Check (CVSS ≥ 7 gate), JaCoCo coverage, SonarQube Quality Gate

**Run locally:**
```bash
cd claims-service
docker run -d --name claims-db \
  -e POSTGRES_DB=claims \
  -e POSTGRES_USER=claims_user \
  -e POSTGRES_PASSWORD=claims_pass \
  -p 5432:5432 postgres:15-alpine
mvn spring-boot:run
# API:    http://localhost:8080/api/v1/claims
# Health: http://localhost:8080/actuator/health
```

**Run SonarQube analysis locally:**
```bash
cd claims-service
mvn clean verify sonar:sonar \
  -Dsonar.projectKey=insurance-claims-platform \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.token=YOUR_TOKEN
# Dashboard: http://localhost:9000/dashboard?id=insurance-claims-platform
```

---

### Project 2 — policy-dashboard (Vanilla JavaScript)

Frontend dashboard for managing insurance claims — no framework, no build step.

**Tech stack:** Vanilla JavaScript (ES modules), Jest, Playwright

**Demonstrates:**
- JavaScript core concepts — closures, event loop, prototypal inheritance,
  `var`/`let`/`const` hoisting, `this` binding (all in `js-concepts/`)
- Design patterns — Observer (EventEmitter), Singleton (apiClient), debounce/throttle
- Promise patterns — `Promise.all` built from scratch, retry with exponential backoff,
  async generators for lazy pagination
- Automated testing — Jest unit tests (37 passing), Playwright E2E (chromium)
- Accessibility — ARIA roles, aria-live, keyboard navigation

**Run locally:**
```bash
cd policy-dashboard
npm install
npx serve src -p 3000
# Open: http://localhost:3000

# Run tests
npm run test:unit     # Jest — 37 unit tests
npm run test:e2e      # Playwright E2E
```

---

### Project 3 — devops-pipeline (CI/CD)

CI/CD pipeline configuration wrapping both projects.

**Tech stack:** GitHub Actions, Jenkins, Docker (multi-stage), OWASP, SonarQube

**Demonstrates:**
- GitHub Actions — 8-job parallel pipeline (build → test → security → docker → deploy)
- Jenkins — equivalent Jenkinsfile with parallel stages and manual approval gate
- SonarQube — static analysis, Quality Gate (Security A, Maintainability A), 45%+ coverage
- DevSecOps — OWASP Dependency-Check (CVSS ≥ 7 gate), npm audit, SonarQube
- Docker — multi-stage builds (JDK→JRE for Java, Nginx alpine for JS)
- Security — OIDC AWS authentication (no long-lived keys), non-root containers
- Artefact immutability — git SHA tagging, same image promoted staging→production

---

## CI/CD Pipeline

```
git push
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Build (parallel)                                   │
│    Java: mvn compile         JS: npm ci             │
├─────────────────────────────────────────────────────┤
│  Unit Tests (parallel)                              │
│    JUnit 5 + Mockito         Jest (37 tests)        │
│    JaCoCo coverage           Coverage report        │
├─────────────────────────────────────────────────────┤
│  Integration & E2E (parallel)                       │
│    Testcontainers            Playwright (chromium)  │
├─────────────────────────────────────────────────────┤
│  Security (parallel)                                │
│    OWASP (CVSS≥7 gate)       npm audit              │
│    SonarQube Quality Gate    Security A rating      │
├─────────────────────────────────────────────────────┤
│  Docker Build                                       │
│    Multi-stage images tagged with git SHA           │
│    Trivy scan before push                           │
├─────────────────────────────────────────────────────┤
│  Deploy Staging → Manual Gate → Deploy Production   │
│    ECS Fargate rolling update                       │
│    Smoke tests + Playwright @smoke suite            │
└─────────────────────────────────────────────────────┘
```

---

## SonarQube Results

Local SonarQube analysis (http://localhost:9000):

| Metric | Result | Rating |
|---|---|---|
| Quality Gate | ✅ Passed | |
| Security | 0 issues | A |
| Maintainability | 36 issues | A |
| Reliability | 9 issues | B |
| Coverage | 45.2% | |
| Duplications | 1.3% | |
| Security Hotspot | 1 (CSRF — reviewed, marked Safe) | |

CSRF hotspot assessment: disabled intentionally — stateless REST API with JWT
authentication has no session cookies, so CSRF attacks do not apply.

---

## Repository Structure

```
insurance-claims-platform/
├── .github/
│   └── workflows/
│       └── ci.yml              ← GitHub Actions CI pipeline (8 jobs)
├── claims-service/             ← Project 1: Java Spring Boot
│   ├── src/main/java/com/insureco/claims/
│   │   ├── pattern/            ← Design patterns
│   │   ├── service/            ← Business logic (SOLID)
│   │   ├── controller/         ← REST API
│   │   └── domain/             ← Domain entities
│   └── src/test/java/
├── policy-dashboard/           ← Project 2: Vanilla JavaScript
│   ├── js-concepts/            ← 8 runnable JS concept demos
│   ├── src/                    ← Frontend source
│   └── tests/                  ← Jest + Playwright tests
├── devops-pipeline/            ← Project 3: DevOps config
│   ├── docker/                 ← Dockerfiles (multi-stage)
│   └── owasp-suppressions.xml  ← Documented CVE suppressions
├── Jenkinsfile                 ← Jenkins pipeline (root)
└── README.md
```

---

## Key Design Decisions

**Why Testcontainers over H2?**
H2 does not support PostgreSQL-specific SQL. Testcontainers runs the same
PostgreSQL version as production — bugs caught in CI, not in prod.

**Why OIDC over AWS access keys?**
OIDC tokens expire in 15 minutes. Long-lived keys are a permanent risk if leaked.
GitHub Actions issues a JWT, AWS validates it and returns temporary credentials.

**Why vanilla JavaScript over React?**
To demonstrate JavaScript fundamentals without framework abstraction —
closures, prototypes, event loop, Promise internals are all visible in the code.

**Why multi-stage Docker builds?**
The production image contains only JRE + JAR (~200MB).
Maven, JDK, source code never reach production — minimal attack surface.

**Why SonarQube alongside OWASP?**
OWASP catches known CVEs in third-party dependencies.
SonarQube catches issues in our own code — bugs, code smells, security hotspots.
They are complementary, not overlapping.

---

## Interview Quick Reference

| Topic | File to open |
|---|---|
| SOLID principles | `claims-service/src/.../service/ClaimsService.java` |
| Singleton thread safety | `claims-service/.../pattern/singleton/ConfigurationManager.java` |
| Composition over Inheritance | `claims-service/.../pattern/CompositionOverInheritanceDemo.java` |
| JavaScript closures | `policy-dashboard/js-concepts/01-closures.js` |
| Promise.all from scratch | `policy-dashboard/js-concepts/06-promise-all.js` |
| Playwright Page Object Model | `policy-dashboard/tests/e2e/pages/ClaimsDashboardPage.js` |
| GitHub Actions pipeline | `.github/workflows/ci.yml` |
| OIDC AWS auth | `.github/workflows/ci.yml` (Configure AWS credentials step) |
| OWASP suppressions | `devops-pipeline/owasp-suppressions.xml` |
| Multi-stage Docker | `devops-pipeline/docker/Dockerfile.claims-service` |
| SonarQube dashboard | http://localhost:9000/dashboard?id=insurance-claims-platform |
| Jenkins pipeline | `Jenkinsfile` (root) |
