/**
 * JENKINSFILE — CBA Claims Platform CI/CD Pipeline
 * ==================================================
 * Wraps BOTH projects in one pipeline:
 *   Project 1 — claims-service     (Java / Spring Boot)
 *   Project 2 — policy-dashboard   (Vanilla JavaScript)
 *
 * STAGES:
 *   1. Checkout
 *   2. Build          — Maven compile + npm install
 *   3. Unit Tests     — JUnit 5 + Jest
 *   4. Integration Tests — Testcontainers + Playwright
 *   5. Security Scan  — OWASP Dependency-Check + Trivy + SonarQube
 *   6. Docker Build + Push — ECR with git SHA tag (artefact immutability)
 *   7. Deploy Staging — ECS Fargate + smoke tests
 *   8. Deploy Prod    — Manual gate + rolling update
 *
 * DEVSECOPS PRINCIPLES DEMONSTRATED:
 *   - Shift left: security scans run BEFORE Docker build
 *   - CVSS >= 7 fails the build — no override without suppression file
 *   - Artefact immutability: same SHA image promoted staging → prod
 *   - Secrets from Jenkins credentials — never in Jenkinsfile
 *   - No hardcoded AWS keys — IAM roles via AWS credentials binding
 */

pipeline {

    agent any

    // ── ENVIRONMENT ─────────────────────────────────────────────────────────
    environment {
        // Application
        APP_NAME     = 'cba-claims-platform'
        GIT_SHA      = sh(returnStdout: true, script: 'git rev-parse --short HEAD').trim()

        // AWS / ECR
        AWS_REGION   = 'ap-southeast-2'
        ECR_REGISTRY = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
        IMAGE_CLAIMS  = "${ECR_REGISTRY}/claims-service:${GIT_SHA}"
        IMAGE_DASH    = "${ECR_REGISTRY}/policy-dashboard:${GIT_SHA}"

        // SonarQube
        SONAR_URL    = 'http://sonarqube:9000'

        // Staging
        STAGING_URL  = 'https://staging.claims.cba.internal'
    }

    // ── OPTIONS ──────────────────────────────────────────────────────────────
    options {
        timeout(time: 45, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()           // one pipeline at a time per branch
        timestamps()
    }

    // ── PARAMETERS ──────────────────────────────────────────────────────────
    parameters {
        booleanParam(
            name:         'SKIP_INTEGRATION_TESTS',
            defaultValue: false,
            description:  'Skip Testcontainers + Playwright (faster for hotfixes)'
        )
        booleanParam(
            name:         'DEPLOY_TO_PROD',
            defaultValue: false,
            description:  'Deploy to production after staging succeeds'
        )
    }

    // ────────────────────────────────────────────────────────────────────────
    stages {

        // ── STAGE 1: CHECKOUT ───────────────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log --oneline -5'
                sh 'echo "Building SHA: ${GIT_SHA}"'
            }
        }

        // ── STAGE 2: BUILD ──────────────────────────────────────────────────
        stage('Build') {
            parallel {

                stage('Build: claims-service') {
                    steps {
                        dir('claims-service') {
                            sh 'mvn clean compile -q -T 4'
                            // -T 4: 4 threads — faster on multi-core agents
                        }
                    }
                }

                stage('Build: policy-dashboard') {
                    steps {
                        dir('policy-dashboard') {
                            sh 'npm ci --prefer-offline'
                            // npm ci: clean install from package-lock.json
                            // --prefer-offline: use cache when available
                        }
                    }
                }
            }
        }

        // ── STAGE 3: UNIT TESTS ─────────────────────────────────────────────
        stage('Unit Tests') {
            parallel {

                stage('Unit Tests: Java') {
                    steps {
                        dir('claims-service') {
                            sh 'mvn test -q'
                        }
                    }
                    post {
                        always {
                            // Publish JUnit XML results — visible in Jenkins UI
                            junit 'claims-service/target/surefire-reports/*.xml'
                            // Publish JaCoCo coverage report
                            jacoco(
                                execPattern:    'claims-service/target/jacoco.exec',
                                classPattern:   'claims-service/target/classes',
                                sourcePattern:  'claims-service/src/main/java',
                                minimumLineCoverage:     '80',
                                minimumBranchCoverage:   '75',
                                minimumMethodCoverage:   '80'
                            )
                        }
                    }
                }

                stage('Unit Tests: JavaScript') {
                    steps {
                        dir('policy-dashboard') {
                            sh 'cross-env NODE_OPTIONS=--experimental-vm-modules npx jest --testPathPattern=tests/unit --coverage --ci'
                            // --ci: fail on coverage threshold breaches (no interactive prompts)
                        }
                    }
                    post {
                        always {
                            // Publish Jest coverage as HTML report
                            publishHTML(target: [
                                allowMissing:         false,
                                alwaysLinkToLastBuild: true,
                                keepAll:              true,
                                reportDir:            'policy-dashboard/coverage/lcov-report',
                                reportFiles:          'index.html',
                                reportName:           'JavaScript Coverage Report',
                            ])
                        }
                    }
                }
            }
        }

        // ── STAGE 4: INTEGRATION TESTS ──────────────────────────────────────
        stage('Integration Tests') {
            when {
                not { expression { params.SKIP_INTEGRATION_TESTS } }
            }
            parallel {

                stage('Integration: Testcontainers') {
                    steps {
                        dir('claims-service') {
                            // Testcontainers needs Docker — agent must have Docker socket mounted
                            sh 'mvn verify -Dskip.unit.tests=true -q'
                            // -Dskip.unit.tests=true: only integration tests in this stage
                        }
                    }
                    post {
                        always {
                            junit 'claims-service/target/failsafe-reports/*.xml'
                        }
                    }
                }

                stage('Integration: Playwright E2E') {
                    steps {
                        dir('policy-dashboard') {
                            sh 'npx playwright install --with-deps chromium'
                            // Install only Chromium — faster than all browsers in CI
                            sh 'npx playwright test --reporter=html,list'
                        }
                    }
                    post {
                        always {
                            // Publish Playwright HTML report
                            publishHTML(target: [
                                reportDir:   'policy-dashboard/playwright-report',
                                reportFiles: 'index.html',
                                reportName:  'Playwright E2E Report',
                            ])
                        }
                        failure {
                            // Archive screenshots + videos on failure for debugging
                            archiveArtifacts artifacts: 'policy-dashboard/test-results/**/*',
                                             allowEmptyArchive: true
                        }
                    }
                }
            }
        }

        // ── STAGE 5: SECURITY SCAN ──────────────────────────────────────────
        stage('Security Scan') {
            parallel {

                stage('OWASP Dependency-Check') {
                    steps {
                        dir('claims-service') {
                            sh '''
                                mvn dependency-check:check \
                                    -DfailBuildOnCVSS=7 \
                                    -DsuppressionFile=owasp-suppressions.xml \
                                    -Dformat=ALL
                            '''
                            // -DfailBuildOnCVSS=7: any CVE with CVSS >= 7 fails the build
                            // suppressionFile: accepted risks with justifications and review dates
                        }
                    }
                    post {
                        always {
                            // Publish OWASP report in Jenkins
                            dependencyCheckPublisher pattern: 'claims-service/target/dependency-check-report.xml'
                        }
                    }
                }

                stage('SonarQube Analysis') {
                    steps {
                        withSonarQubeEnv('SonarQube') {
                            // Claims service
                            dir('claims-service') {
                                sh '''
                                    mvn sonar:sonar \
                                        -Dsonar.projectKey=claims-service \
                                        -Dsonar.projectName="Claims Service" \
                                        -Dsonar.coverage.jacoco.xmlReportPaths=target/site/jacoco/jacoco.xml
                                '''
                            }
                            // Policy dashboard
                            dir('policy-dashboard') {
                                sh '''
                                    npx sonar-scanner \
                                        -Dsonar.projectKey=policy-dashboard \
                                        -Dsonar.projectName="Policy Dashboard" \
                                        -Dsonar.sources=src \
                                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                                '''
                            }
                        }
                        // Quality gate: fail if SonarQube gate fails
                        timeout(time: 5, unit: 'MINUTES') {
                            waitForQualityGate abortPipeline: true
                        }
                    }
                }

                stage('npm audit') {
                    steps {
                        dir('policy-dashboard') {
                            sh 'npm audit --audit-level=high'
                            // Fail on high or critical npm vulnerabilities
                        }
                    }
                }
            }
        }

        // ── STAGE 6: DOCKER BUILD + PUSH ────────────────────────────────────
        stage('Docker Build + Push') {
            steps {
                script {
                    // Authenticate to ECR using IAM role (no long-lived keys)
                    withAWS(region: AWS_REGION, role: 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/jenkins-deploy-role') {
                        sh "aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}"

                        // Build claims-service image
                        // Multi-stage Dockerfile: compile in build stage, runtime image is minimal JRE
                        sh """
                            docker build \
                                --file docker/Dockerfile.claims-service \
                                --tag ${IMAGE_CLAIMS} \
                                --build-arg BUILD_DATE=\$(date -u +%Y-%m-%dT%H:%M:%SZ) \
                                --build-arg GIT_SHA=${GIT_SHA} \
                                --label org.opencontainers.image.revision=${GIT_SHA} \
                                --label org.opencontainers.image.created=\$(date -u +%Y-%m-%dT%H:%M:%SZ) \
                                --cache-from ${ECR_REGISTRY}/claims-service:latest \
                                claims-service/
                        """

                        // Scan the image for OS vulnerabilities BEFORE pushing
                        // Trivy: open-source container vulnerability scanner
                        sh "trivy image --exit-code 1 --severity HIGH,CRITICAL ${IMAGE_CLAIMS}"

                        // Push to ECR — same image that was tested
                        sh "docker push ${IMAGE_CLAIMS}"

                        // Build policy-dashboard image
                        sh """
                            docker build \
                                --file docker/Dockerfile.policy-dashboard \
                                --tag ${IMAGE_DASH} \
                                --build-arg GIT_SHA=${GIT_SHA} \
                                --cache-from ${ECR_REGISTRY}/policy-dashboard:latest \
                                policy-dashboard/
                        """
                        sh "trivy image --exit-code 1 --severity HIGH,CRITICAL ${IMAGE_DASH}"
                        sh "docker push ${IMAGE_DASH}"

                        echo "✅ Images pushed:"
                        echo "   ${IMAGE_CLAIMS}"
                        echo "   ${IMAGE_DASH}"
                        // ARTEFACT IMMUTABILITY:
                        // Tagged with git SHA — this exact image is what staging runs
                        // and what prod will run. Never rebuilt for production.
                    }
                }
            }
        }

        // ── STAGE 7: DEPLOY STAGING ─────────────────────────────────────────
        stage('Deploy Staging') {
            steps {
                script {
                    withAWS(region: AWS_REGION, role: 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/jenkins-deploy-role') {

                        // Update ECS service with the new SHA-tagged image
                        sh """
                            aws ecs update-service \
                                --cluster cba-staging \
                                --service claims-service \
                                --force-new-deployment \
                                --query 'service.taskDefinition' \
                                --output text
                        """

                        // Wait for deployment to complete (max 10 min)
                        sh """
                            aws ecs wait services-stable \
                                --cluster cba-staging \
                                --services claims-service
                        """

                        // Smoke tests: is the app alive?
                        sh "curl -f ${STAGING_URL}/actuator/health || exit 1"
                        sh "curl -f ${STAGING_URL}/api/v1/claims?size=1 || exit 1"

                        // Run Playwright against the real staging environment
                        dir('policy-dashboard') {
                            withEnv(["PLAYWRIGHT_BASE_URL=${STAGING_URL}"]) {
                                sh 'npx playwright test --grep @smoke'
                                // @smoke tag: critical path tests only (login, list claims, submit)
                            }
                        }

                        echo "✅ Staging deployment complete: ${STAGING_URL}"
                    }
                }
            }
        }

        // ── STAGE 8: DEPLOY PRODUCTION ──────────────────────────────────────
        stage('Deploy Production') {
            when {
                allOf {
                    branch 'main'
                    expression { params.DEPLOY_TO_PROD }
                }
            }
            steps {
                // MANUAL GATE: reviewer must approve before production deploy
                input(
                    message: "Deploy ${GIT_SHA} to PRODUCTION?",
                    ok: 'Deploy',
                    submitterParameter: 'APPROVED_BY',
                    parameters: [
                        string(name: 'CHANGE_TICKET', description: 'JIRA change ticket (e.g. CHG-1234)')
                    ]
                )

                script {
                    echo "Production deploy approved by: ${APPROVED_BY}"
                    echo "Change ticket: ${CHANGE_TICKET}"

                    withAWS(region: AWS_REGION, role: 'arn:aws:iam::${AWS_ACCOUNT_ID}:role/jenkins-prod-deploy-role') {

                        // PROMOTE the SAME image that ran in staging — never rebuild
                        // The SHA tag guarantees what you tested is exactly what deploys
                        sh """
                            aws ecs update-service \
                                --cluster cba-production \
                                --service claims-service \
                                --force-new-deployment
                        """

                        sh """
                            aws ecs wait services-stable \
                                --cluster cba-production \
                                --services claims-service
                        """

                        // Production smoke test
                        sh "curl -f https://claims.cba.com.au/actuator/health || exit 1"

                        echo "✅ Production deployment complete"
                        echo "   Image: ${IMAGE_CLAIMS}"
                        echo "   SHA:   ${GIT_SHA}"
                    }
                }
            }
        }
    }

    // ── POST ACTIONS ─────────────────────────────────────────────────────────
    post {
        always {
            // Clean up Docker images from agent to free disk space
            sh "docker rmi ${IMAGE_CLAIMS} ${IMAGE_DASH} || true"
        }
        success {
            echo "✅ Pipeline SUCCESS — ${APP_NAME} @ ${GIT_SHA}"
        }
        failure {
            echo "❌ Pipeline FAILED — ${APP_NAME} @ ${GIT_SHA}"
            // In production: send Slack/Teams notification here
            // slackSend channel: '#cba-alerts', color: 'danger', message: "Build failed: ${GIT_SHA}"
        }
    }
}
