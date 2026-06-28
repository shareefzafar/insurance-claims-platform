# DevOps Pipeline — CBA Claims Platform

CI/CD pipeline that builds, tests, security-scans, and deploys both:
- **Project 1** — `claims-service` (Java / Spring Boot)
- **Project 2** — `policy-dashboard` (Vanilla JavaScript)

Covers: Jenkins, GitHub Actions, Docker, OWASP, Trivy, SonarQube, OIDC AWS auth, ECS Fargate.

---

## Repository Structure

```
devops-pipeline/
├── Jenkinsfile                          ← 8-stage Jenkins CI/CD pipeline
├── .github/
│   └── workflows/
│       ├── ci.yml                       ← GitHub Actions: build + test + scan
│       └── deploy.yml                   ← GitHub Actions: staging + production
├── docker/
│   ├── Dockerfile.claims-service        ← Multi-stage Java build (JDK → JRE)
│   ├── Dockerfile.policy-dashboard      ← Nginx serving vanilla JS
│   └── nginx.conf                       ← Nginx reverse proxy + security headers
├── owasp-suppressions.xml               ← CVE suppressions with justifications
├── sonar-project.properties             ← SonarQube config for both projects
└── README.md
```

---

## Pipeline Overview

```
git push
   │
   ▼
┌─────────────────────────────────────────────────────────────┐
│  Build  ──────────────────────────────────────────────────  │
│    mvn clean compile         npm ci                         │
├─────────────────────────────────────────────────────────────┤
│  Unit Tests (parallel)                                      │
│    JUnit 5 + Mockito         Jest                           │
│    JaCoCo >= 80%             Coverage >= 75%                │
├─────────────────────────────────────────────────────────────┤
│  Integration Tests (parallel)                               │
│    Testcontainers PostgreSQL  Playwright E2E                │
├─────────────────────────────────────────────────────────────┤
│  Security Scan (parallel)                                   │
│    OWASP Dep-Check           npm audit                      │
│    CVSS >= 7 fails build     High/Critical fails build      │
│    SonarQube quality gate    Trivy image scan               │
├─────────────────────────────────────────────────────────────┤
│  Docker Build + Push                                        │
│    Multi-stage (JDK → JRE)   Nginx alpine                  │
│    Tagged with git SHA        Trivy scanned before push     │
│    OIDC auth to ECR           No long-lived AWS keys        │
├─────────────────────────────────────────────────────────────┤
│  Deploy Staging                                             │
│    ECS Fargate rolling update                               │
│    Smoke tests + Playwright @smoke                          │
├─────────────────────────────────────────────────────────────┤
│  Manual Approval Gate                                       │
│    Jenkins: input()                                         │
│    GitHub:  Environment protection rules (required reviewers)│
├─────────────────────────────────────────────────────────────┤
│  Deploy Production                                          │
│    Promote SAME SHA image from staging — never rebuild      │
│    ECS rolling update + health check                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Jenkins vs GitHub Actions — Side by Side

| Concept | Jenkins (Jenkinsfile) | GitHub Actions (.yml) |
|---|---|---|
| Pipeline definition | `pipeline { stages { } }` | `jobs:` |
| Stage | `stage('Build') { }` | `build-java:` job |
| Shell command | `sh 'mvn compile'` | `run: mvn compile` |
| Agent / Runner | `agent any` | `runs-on: ubuntu-latest` |
| Shared Library | `@Library('shared')` | `uses: org/action@v1` |
| Manual gate | `input 'Deploy to prod?'` | `environment: production` with required reviewers |
| Credentials | `withCredentials([])` | `secrets.*` |
| Parallel stages | `parallel { stage() {} }` | `needs:` + jobs run in parallel by default |
| Artefacts | `archiveArtifacts` | `actions/upload-artifact@v4` |
| Test results | `junit '*.xml'` | `dorny/test-reporter@v1` |

---

## DevSecOps Practices

### 1. Shift Left — Security in CI, Not After

Security runs **before** Docker build and **before** any deployment:

```
Unit Tests → Integration Tests → OWASP + npm audit + SonarQube → Docker Build
```

A CVE found in OWASP scan stops the pipeline before any image is built.
The developer fixes it before it ever reaches staging.

### 2. OWASP Dependency-Check Gate

```bash
mvn dependency-check:check -DfailBuildOnCVSS=7
```

- Any CVE with CVSS >= 7 **fails the build**
- Exceptions require documented entry in `owasp-suppressions.xml`
- Suppressions must include: justification, owner, review date
- Review dates are enforced — expired suppressions block the pipeline

### 3. OIDC AWS Authentication — No Long-Lived Keys

```yaml
- name: Configure AWS credentials via OIDC
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
```

**Why OIDC is better than AWS keys:**

| | Long-lived keys | OIDC (this pipeline) |
|---|---|---|
| Stored in GitHub | Yes — permanent risk if leaked | No — only role ARN stored |
| Expiry | Never (until manually rotated) | 15 minutes automatically |
| If intercepted | Permanent compromise | Useless in minutes |
| Rotation burden | Manual, error-prone | None — automatic |

### 4. Artefact Immutability

Every Docker image is tagged with the git SHA:

```
ECR_URI/claims-service:a1b2c3d  ← built once in CI
```

- This exact image runs in staging
- This exact image is promoted to production (never rebuilt)
- What you tested is exactly what deploys
- Rollback = deploy a previous SHA tag (image still in ECR)

### 5. Multi-Stage Docker Build — Minimal Attack Surface

```dockerfile
# Stage 1: Full JDK + Maven — compiles the JAR
FROM eclipse-temurin:21-jdk-jammy AS build
RUN mvn clean package -DskipTests

# Stage 2: JRE only — runs the JAR
FROM eclipse-temurin:21-jre-jammy AS runtime
COPY --from=build target/claims-service-*.jar app.jar
USER appuser  # non-root
```

Production image contains: JRE + JAR only.
Maven, JDK, source code, build tools — **never** in the production image.

### 6. Trivy Image Scanning

```yaml
- name: Trivy scan
  uses: aquasecurity/trivy-action@master
  with:
    severity:  HIGH,CRITICAL
    exit-code: '1'
```

Scans the built Docker image for OS-level vulnerabilities **before pushing to ECR**.
Results uploaded to GitHub Security tab as SARIF.

---

## Secrets Management

No secrets are hardcoded anywhere. All injected at runtime:

| Secret | Where stored | How injected |
|---|---|---|
| DB password | AWS Secrets Manager | ECS task definition ARN reference |
| JWT signing key | AWS Secrets Manager | ECS task definition ARN reference |
| SonarQube token | GitHub Secrets | `${{ secrets.SONAR_TOKEN }}` |
| NVD API key | GitHub Secrets | `${{ secrets.NVD_API_KEY }}` |
| AWS role ARN | GitHub Secrets | `${{ secrets.AWS_ROLE_ARN }}` |
| AWS credentials | OIDC (temporary) | `aws-actions/configure-aws-credentials` |

ECS task definition secret reference (no plaintext value):
```json
"secrets": [
  {
    "name": "DB_PASSWORD",
    "valueFrom": "arn:aws:secretsmanager:ap-southeast-2:123456789:secret:prod/db-password"
  }
]
```

---

## Running Locally

### Build both Docker images

```bash
# Claims service
docker build -f docker/Dockerfile.claims-service -t claims-service:local ../claims-service/

# Policy dashboard
docker build -f docker/Dockerfile.policy-dashboard -t policy-dashboard:local ../policy-dashboard/
```

### Run locally with docker-compose

```bash
docker-compose up
# claims-service:    http://localhost:8080
# policy-dashboard:  http://localhost:3000
```

### Run OWASP scan locally

```bash
cd ../claims-service
mvn dependency-check:check -DfailBuildOnCVSS=7
open target/dependency-check-report.html
```

### Run Trivy scan locally

```bash
# Install: brew install trivy (Mac) or snap install trivy (Linux)
trivy image --severity HIGH,CRITICAL claims-service:local
```

---

## Interview Quick Reference

**"Explain your CI/CD pipeline"**
> We have a Jenkins pipeline for the internal environment and GitHub Actions for the cloud path. Both follow the same stages: build, unit tests, integration tests with Testcontainers and Playwright, security scanning with OWASP and Trivy, Docker build with git SHA tagging, staging deploy with smoke tests, manual approval gate, then production. The same SHA-tagged image that passes CI is what deploys to production — never rebuilt.

**"What is OIDC and why use it instead of AWS keys?"**
> OIDC lets GitHub Actions assume an IAM role via a short-lived JWT — no AWS_ACCESS_KEY_ID ever stored in GitHub. GitHub issues the JWT, AWS validates it and returns temporary credentials that expire in 15 minutes. Even if intercepted, they're useless quickly. Long-lived keys are a permanent security risk if leaked — OIDC eliminates that.

**"What is artefact immutability?"**
> We tag every Docker image with the git SHA — `claims-service:a1b2c3d`. That exact image runs in staging. When we approve production deployment, we promote that same SHA image — we never rebuild for production. What you tested in CI is exactly what runs in production. Rollback is deploying a previous SHA — the image is still in ECR.

**"How do you handle CVEs?"**
> OWASP Dependency-Check runs in CI. Any CVE with CVSS >= 7 fails the build. If a CVE is a false positive or genuinely not exploitable in our context, we document it in owasp-suppressions.xml with a justification, owner, and review date. Expired suppressions block the pipeline — they must be renewed. In practice, when we found CVE-2022-42003 in jackson-databind (CVSS 7.5), we verified the vulnerable code path wasn't reachable in our application, documented it, and upgraded to the patched version in the next sprint.

**"Jenkins vs GitHub Actions — how are they different?"**
> Same model, different syntax. Jenkins: Jenkinsfile with stage() blocks and sh commands. GitHub Actions: YAML with jobs and run steps. GitHub Actions has OIDC built in for AWS — no long-lived keys. GitHub Actions environment protection rules replace Jenkins input() gates. GitHub Actions is closer to the code — the workflow lives in the repository. Jenkins is self-hosted — more control but more maintenance overhead.
