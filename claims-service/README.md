# Claims Microservice

Spring Boot microservice built for the CBA Software Engineer client round.
Demonstrates SOLID principles, DRY, Composition over Inheritance, Design Patterns,
Automated Testing, and DevSecOps — every concept linked to a specific file and line.

---

## Project Structure

```
src/main/java/com/allianz/claims/
├── ClaimsServiceApplication.java
├── config/
│   └── SecurityConfig.java               ← OAuth2 JWT, @PreAuthorize, stateless
├── controller/
│   └── ClaimsController.java             ← HTTP layer only (SRP)
├── domain/
│   ├── Claim.java                        ← Builder pattern, immutability, state machine
│   ├── ClaimStatus.java                  ← canTransitionTo() — DRY + SRP
│   ├── ClaimType.java                    ← OCP extension point
│   └── PolicyHolder.java
├── dto/
│   ├── request/CreateClaimRequest.java   ← @Valid bean validation
│   └── response/ClaimResponse.java       ← from(Claim) DRY mapping
├── exception/
│   ├── GlobalExceptionHandler.java       ← SRP + DRY error format
│   ├── ClaimNotFoundException.java
│   └── InvalidClaimTransitionException.java
├── pattern/
│   ├── singleton/
│   │   └── ConfigurationManager.java     ← Bill Pugh + double-checked locking
│   ├── strategy/
│   │   ├── NotificationStrategy.java     ← OCP + DIP + ISP + LSP + Composition
│   │   ├── NotificationStrategyImpl.java ← Email (@Primary), SMS, SNS
│   │   └── NotificationResult.java       ← Builder pattern (result object)
│   ├── observer/
│   │   ├── ClaimEventObserver.java       ← ClaimEventListener interface, 3 listeners
│   │   ├── ClaimEvent.java               ← Domain event for claim lifecycle changes
│   │   └── ClaimEventPublisher.java      ← Publisher component with Spring integration
│   ├── factory/
│   │   ├── ClaimProcessorFactory.java    ← OCP — no switch statement
│   │   └── ClaimProcessor.java           ← Abstract processor for type-specific handlers
│   └── CompositionOverInheritanceDemo.java ← explicit wrong vs right contrast
├── repository/
│   ├── ClaimRepository.java              ← DIP interface
│   └── PolicyHolderRepository.java
└── service/
    └── ClaimsService.java                ← All 5 SOLID principles applied here

src/test/java/com/allianz/claims/
├── controller/ClaimsControllerTest.java  ← @WebMvcTest, JWT roles, 401/403/404
├── pattern/ConfigurationManagerTest.java ← 50 threads, singleton guarantee
├── repository/ClaimRepositoryTest.java   ← Testcontainers PostgreSQL
└── service/
    ├── ClaimDomainTest.java              ← Builder + state transitions
    └── ClaimsServiceTest.java            ← Mockito unit tests
```

---

## SOLID Principles

### S — Single Responsibility Principle

Every class has exactly one reason to change.

**`service/ClaimsService.java` — business orchestration only**
```
SRP: This class handles ONLY business orchestration.
     Notification  → NotificationStrategy (injected)
     Payout calc   → ClaimProcessor (from factory)
     Event publish → ClaimEventPublisher (injected)
     Persistence   → ClaimRepository (injected)
```
If the email template changes → touch `EmailNotificationStrategy` only.
If the payout formula changes → touch `HomeClaimProcessor` only.
`ClaimsService` is never touched for either change.

**`controller/ClaimsController.java` — HTTP concerns only**
```
SRP: This class handles ONLY HTTP concerns:
     - URL mapping
     - Request/response serialisation
     - HTTP status codes
     - Authentication principal extraction

ZERO business logic here — all delegated to ClaimsService.
ZERO try/catch here — GlobalExceptionHandler handles all exceptions.
```

**`exception/GlobalExceptionHandler.java` — exception mapping only**
```
Global exception handler — SRP applied to error handling.
DRY: Error response format is defined once in ErrorResponse — used everywhere.
```
Five `@ExceptionHandler` methods — one class, one responsibility.
Controllers have zero try/catch because of this class.

**`pattern/observer/ClaimEventObserver.java` — `AuditLogListener`**
```
SRP: Only responsibility = audit logging.
```
`AuditLogListener` logs. `ApprovalNotificationListener` notifies.
`RejectionListener` triggers appeals. Each listener has one job.

**`domain/ClaimStatus.java` — knows only its own transitions**
```
DRY: transition validation in ONE place.
SRP: status knows its own valid transitions.
```
```java
public boolean canTransitionTo(ClaimStatus next) {
    return switch (this) {
        case SUBMITTED    -> next == UNDER_REVIEW || next == REJECTED;
        case UNDER_REVIEW -> next == APPROVED || next == REJECTED;
        case APPROVED     -> next == PAID;
        case REJECTED, PAID -> false; // terminal states
    };
}
```

---

### O — Open/Closed Principle

Open for extension. Closed for modification.
Three concrete extension points — all requiring zero changes to existing code.

**Extension point 1 — New notification channel**
File: `pattern/strategy/NotificationStrategy.java`
```
OCP: New notification channels (WhatsApp, Push) = new class only.
     ClaimsService never changes.
```
```java
// Adding WhatsApp — one new @Component, nothing else changes
@Component
@ConditionalOnProperty(name = "notification.channel", havingValue = "whatsapp")
class WhatsAppNotificationStrategy implements NotificationStrategy {
    @Override public NotificationResult notify(Claim claim) { ... }
    @Override public String getChannelName() { return "WHATSAPP"; }
}
```

**Extension point 2 — New claim type**
File: `pattern/factory/ClaimProcessorFactory.java`
```
OCP: Adding a new claim type (e.g. TRAVEL) requires:
  1. Add TRAVEL to ClaimType enum
  2. Create TravelClaimProcessor @Component
  3. Zero changes to ClaimProcessorFactory or ClaimsService

WHY NOT A SWITCH STATEMENT?
  switch (type) { case HOME: return new HomeClaimProcessor(); ... }
  - Every new claim type requires modifying this class (OCP violation)
  - New processor = new @Component class, zero changes here
```
```java
// ClaimType.java
public enum ClaimType {
    HOME, HEALTH, VEHICLE
    // OCP: Add TRAVEL, LIFE etc here.
    // Each new value needs a new ClaimProcessor @Component — nothing else changes.
}
```

**Extension point 3 — New event listener**
File: `pattern/observer/ClaimEventObserver.java`
```
OCP: Add new listeners (e.g. FraudCheckListener) without changing the publisher.
```
```java
// Adding FraudCheckListener — zero changes to ClaimEventPublisher
@Component
class FraudCheckListener implements ClaimEventListener {
    @Override public void onClaimStatusChanged(ClaimEvent event) { ... }
}
```

---

### L — Liskov Substitution Principle

A subtype must honour its parent's CONTRACT, not just its syntax.

**File: `pattern/strategy/NotificationStrategy.java`**

The contract is declared explicitly on the interface:
```java
/**
 * CONTRACT (LSP): Every implementation MUST send the notification.
 * A no-op implementation violates LSP — callers trust the contract.
 */
NotificationResult notify(Claim claim);
```

**`EmailNotificationStrategy` — LSP COMPLIANT**
```
LSP COMPLIANT: Honoured contract — when notify() is called, an email IS sent.
Not a no-op. Not a stub. The caller can trust the contract.
```

**`SmsNotificationStrategy` — LSP COMPLIANT**
Different delivery mechanism, same guarantee: when `notify()` is called,
an SMS IS sent. ClaimsService substitutes any strategy and never notices.

**LSP violation — what NOT to do (documented in the interface javadoc):**
```java
// This compiles. It runs. Customer never notified. LSP BROKEN.
class SilentNotificationService implements NotificationStrategy {
    @Override public NotificationResult notify(Claim claim) {
        // does nothing — contract broken silently
    }
}
```

From `ClaimsService.java`:
```
LSP: NotificationStrategy contract: notify() WILL deliver.
     Any strategy substituted here honours that contract.
```

---

### I — Interface Segregation Principle

Clients should not depend on interfaces they do not use.

**File: `pattern/strategy/NotificationStrategy.java`**
```
ISP: Interface has only ONE method — exactly what every client needs.
     No stubbing of unused methods.
```

**File: `pattern/observer/ClaimEventObserver.java`**
```
ISP: One focused method — every listener only implements what it needs.
```

**File: `service/ClaimsService.java`**
```
ISP: This class depends only on focused interfaces — not fat ones.
     ClaimRepository:      data access only
     NotificationStrategy: notification only
```

All interfaces in this project — `NotificationStrategy`, `ClaimProcessor`,
`ClaimEventListener`, `ClaimRepository` — are single-purpose.
No client is ever forced to implement or stub a method it does not use.

---

### D — Dependency Inversion Principle

Depend on abstractions, not concretions.

**File: `service/ClaimsService.java`**
```java
// All dependencies are INTERFACES — DIP applied
public ClaimsService(ClaimRepository      claimRepository,      // interface
                     NotificationStrategy notificationStrategy,  // interface
                     ClaimEventPublisher  eventPublisher,        // @Component
                     ClaimProcessorFactory processorFactory) {   // @Component

    // Spring resolves each interface to the correct @Component at runtime
    // ClaimsService never imports EmailNotificationStrategy directly
    // New notification channel: Spring injects it — ClaimsService untouched
}
```

**File: `repository/ClaimRepository.java`**
```
DIP: ClaimsService depends on this interface, not its JPA implementation.
     In tests: replaced by Testcontainers PostgreSQL or @DataJpaTest.
```

**File: `pattern/observer/ClaimEventObserver.java`**
```
DIP: ClaimEventPublisher depends on THIS interface, not on concrete listeners.
     Publisher does NOT import any concrete listener class (DIP).
```

**File: `pattern/factory/ClaimProcessorFactory.java`**
```
DIP: ClaimsService depends on this interface + ClaimProcessorFactory.
     It never imports HomeClaimProcessor or HealthClaimProcessor directly.
```

Spring's IoC container enforces DIP automatically — every constructor-injected
interface is resolved to the correct `@Component` at runtime with zero coupling
in the business code.

---

## DRY — Don't Repeat Yourself

Every piece of knowledge has exactly one authoritative representation.
Five concrete examples extracted from the codebase:

**1. `findClaimById()` — private helper**
File: `service/ClaimsService.java`
```
DRY: findClaimById used in multiple methods — one place to maintain.
```
```java
// Used in getClaim(), approveClaim(), rejectClaim() — same logic, one method
private Claim findClaimById(String claimId) {
    return claimRepository.findById(claimId)
        .orElseThrow(() -> new ClaimNotFoundException(claimId));
}
```

**2. `canTransitionTo()` — state machine rules**
File: `domain/ClaimStatus.java`
```
DRY: transition validation in ONE place.
     ClaimStatus.canTransitionTo() contains the rules — not duplicated here.
```
Transition rules are defined once in the enum. `approveClaim()`, `rejectClaim()`,
`markPaid()` in `ClaimsService` all call this single method — the rules are
never copy-pasted across methods.

**3. `ClaimResponse.from()` — DTO mapping**
File: `dto/response/ClaimResponse.java`
```
DRY: mapping from domain to DTO in ONE place.
     Static factory method from(Claim) keeps mapping logic in one place (DRY).
     If Claim adds a new field, update here — not in 5 different controllers.
```
```java
public static ClaimResponse from(Claim claim) {
    return new ClaimResponse(
        claim.getId(), claim.getPolicyId(), claim.getType(), ...
    );
}
```

**4. `ErrorResponse` record — error format**
File: `exception/GlobalExceptionHandler.java`
```
DRY: Error response format is defined once in ErrorResponse — used everywhere.
```
```java
public record ErrorResponse(String code, String message,
                            List<FieldViolation> violations, LocalDateTime timestamp) {
    public static ErrorResponse of(String code, String message) { ... }
    public static ErrorResponse validationFailed(List<FieldViolation> violations) { ... }
}
```
Five `@ExceptionHandler` methods all return `ErrorResponse` — consistent format,
defined once, no duplication across handlers.

**5. `maskPhone()` — phone masking**
File: `pattern/strategy/NotificationStrategyImpl.java`
```
DRY: mask phone for logging — one place to change if masking rules change.
```
```java
private String maskPhone(String phone) {
    if (phone == null || phone.length() < 4) return "****";
    return "****" + phone.substring(phone.length() - 4);
}
```

**6. `supports()` — selective listener filtering**
File: `pattern/observer/ClaimEventObserver.java`
```
DRY: Status check is in one place (supports method), not scattered across the handler.
```
`ApprovalNotificationListener.supports()` returns true only for APPROVED events.
The status check lives once — not duplicated inside `onClaimStatusChanged()`.

---

## Composition over Inheritance

Build behaviour by assembling collaborators (has-a), not extending class hierarchies (is-a).

### The Wrong Approach — Inheritance

File: `pattern/CompositionOverInheritanceDemo.java` (commented-out section)
```
APPROACH 1 — WRONG: Inheritance (do NOT use this)

BaseClaimProcessor defines process() which all subclasses call via super.process().
If BaseClaimProcessor changes (e.g. adds a new timeout), ALL subclasses are affected
whether they want the change or not — even if they override process().

The call chain: HomeClaimProcessor.process() → super → BaseClaimProcessor.process()
is invisible and fragile. A change to the parent silently breaks children.

Cannot swap processing strategies at runtime — the class hierarchy is fixed at compile time.
```

```java
// WRONG — fragile base class (commented out in the demo file)
abstract class BaseClaimProcessor {
    BigDecimal process(Claim claim) {
        validateCommon(claim);         // FRAGILE: adding behaviour here breaks all subclasses
        return calculatePayout(claim);
    }
    protected abstract BigDecimal calculatePayout(Claim claim);
}
class HomeClaimProcessor extends BaseClaimProcessor { ... }    // coupled to base
class VehicleClaimProcessor extends BaseClaimProcessor { ... } // coupled to base
// Adding TRAVEL: new subclass + modify factory switch — OCP violated
```

### The Right Approach — Composition

File: `pattern/strategy/NotificationStrategy.java`
```
COMPOSITION OVER INHERITANCE:
 Bad approach:  BaseNotificationService → EmailNotificationService → SmsNotificationService
 - Fragile base class problem
 - Changing BaseNotificationService breaks all subclasses
 - Cannot swap strategies at runtime

 Good approach (this): ClaimsService has-a NotificationStrategy
 - Each strategy is independently testable
 - Strategies are swappable at runtime
 - Adding a new strategy = zero changes to existing code
```

File: `pattern/CompositionOverInheritanceDemo.java` (active section)
```
APPROACH 2 — CORRECT: Composition via interface

ClaimsService HAS-A ClaimProcessor (injected — DIP).
Each processor is independent — no inheritance, no super() calls, no coupling.
Adding TRAVEL: new TravelClaimProcessor @Component. Nothing else changes.
```

```java
// RIGHT — composition
interface ClaimPayoutCalculator {
    BigDecimal calculate(Claim claim);
    ClaimType supports();
}
@Component class HomePayoutCalculator    implements ClaimPayoutCalculator { ... } // independent
@Component class VehiclePayoutCalculator implements ClaimPayoutCalculator { ... } // independent
// Adding TRAVEL: @Component class TravelPayoutCalculator — nothing else changes
```

### Side-by-Side Comparison

From `pattern/CompositionOverInheritanceDemo.java`:

| | Inheritance | Composition (this project) |
|---|---|---|
| Adding TRAVEL type | New subclass + modify existing factory | New `@Component` only — zero other changes |
| Base class changes | Silently breaks all subclasses | No base class — fragile base class gone |
| Testing in isolation | Must instantiate parent hierarchy | Direct instantiation, no parent dependency |
| Runtime swapping | Not possible — fixed at compile time | `@ConditionalOnProperty` — one config change |

**Where composition is applied in this project:**

`ClaimsService` has-a `NotificationStrategy` (interface)
→ Email, SMS, SNS are independent `@Component` classes
→ Swap via `notification.channel` property — zero code change

`ClaimProcessorFactory` routes to `ClaimProcessor` (interface)
→ Home, Health, Vehicle are independent `@Component` classes
→ Spring auto-registers all processors — no switch statement

`ClaimEventPublisher` notifies via `ClaimEventListener` (interface)
→ AuditLogListener, ApprovalNotificationListener, RejectionListener are independent
→ Each fails in isolation — one bad listener does not break others

---

## Design Patterns

### Singleton — Thread-Safe ConfigurationManager

File: `pattern/singleton/ConfigurationManager.java`

Two implementations shown side by side for interview discussion:

**Bill Pugh (preferred):**
```java
private static class Holder {
    private static final ConfigurationManager INSTANCE = new ConfigurationManager();
    // JVM guarantees class loading is atomic and thread-safe — no locks needed
}
public static ConfigurationManager getInstance() {
    return Holder.INSTANCE;
}
```

**Double-checked locking (shown for interview awareness):**
```java
private static volatile ConfigurationManager doubleCheckedInstance;
//                ^ volatile: ensures changes are visible across all threads immediately
//                  Without volatile: thread A writes a half-constructed object,
//                  thread B sees instance != null and returns a broken object.

public static ConfigurationManager getInstanceDCL() {
    if (doubleCheckedInstance == null) {             // First check — no lock (fast path)
        synchronized (ConfigurationManager.class) {
            if (doubleCheckedInstance == null) {     // Second check — with lock (safe)
                doubleCheckedInstance = new ConfigurationManager();
            }
        }
    }
    return doubleCheckedInstance;
}
```

**Wrong approach (documented as counter-example):**
```
private static ConfigurationManager wrong; // NOT volatile — broken
// Thread A checks: null. Thread B also checks: null.
// Both create an instance. Two instances in memory — singleton violated.
```

Used in `ClaimsService.approveClaim()` — reads `claims.max.amount` from the single instance.

---

### Strategy Pattern — NotificationStrategy

File: `pattern/strategy/NotificationStrategy.java` + `NotificationStrategyImpl.java`

`ClaimsService` has-a `NotificationStrategy` (interface).
Spring injects the active implementation based on `notification.channel` property.

```properties
notification.channel=email  → EmailNotificationStrategy (@Primary, default)
notification.channel=sms    → SmsNotificationStrategy
notification.channel=sns    → SnsNotificationStrategy
```

SOLID coverage: OCP (new channel = new class), DIP (interface injected), ISP (one method),
LSP (every impl honours the contract).

---

### Builder Pattern — Claim

File: `domain/Claim.java`

```
WHY NOT LOMBOK @Builder?
 Lombok @Builder does not enforce mandatory fields at compile time.
 Manual Builder: constructor takes mandatory fields — you cannot forget them.
 In production code use Lombok for brevity. Here: manual Builder for the interview demo.
```

```java
// Mandatory fields in constructor — cannot be forgotten (compile error if omitted)
Claim claim = Claim.builder("POL-001", BigDecimal.valueOf(500), ClaimType.HOME, holder)
    .description("Water damage to roof")  // optional
    .build();                              // cross-field validation runs here
```

- Mandatory fields: `policyId`, `amount`, `type`, `policyHolder` — in constructor
- Optional fields: `description`, `supportingDocumentUrl` — fluent setters
- Cross-field validation in `build()` — HEALTH claims require description
- All fields `private final` — immutable after construction
- Private constructor — only `Builder` can create a `Claim`

---

### Observer Pattern — ClaimEventPublisher

File: `pattern/observer/ClaimEventObserver.java`

`ClaimEventPublisher` maintains a list of `ClaimEventListener` implementations.
Spring injects all `@Component` listeners via `List<ClaimEventListener>` constructor.

```
DIP: Publisher does NOT import any concrete listener class.
OCP: Add new listeners without changing the publisher.
ISP: One focused method — every listener only implements what it needs.
```

Three listeners included:
- `AuditLogListener` — handles ALL events (SRP: audit logging only)
- `ApprovalNotificationListener` — handles APPROVED only (`supports()` filter, DRY)
- `RejectionListener` — handles REJECTED only (triggers appeals process)

Contract on `ClaimEventListener`:
```
CONTRACT: This method must not throw exceptions — failures must be handled internally.
          A failing listener must not break other listeners or the publishing flow.
```
Publisher wraps each listener call in try/catch — isolated failure guaranteed.

---

### Factory Pattern — ClaimProcessorFactory

File: `pattern/factory/ClaimProcessorFactory.java`

```
WHY NOT A SWITCH STATEMENT?
  switch (type) { case HOME: return new HomeClaimProcessor(); ... }
  - Every new claim type requires modifying this class (OCP violation)
  - Cannot inject dependencies into processors
  - New processor = new @Component class, zero changes here
```

Spring injects all `ClaimProcessor` implementations into a `List<ClaimProcessor>`.
Factory builds a `Map<ClaimType, ClaimProcessor>` for O(1) lookup — no switch.

```java
public ClaimProcessorFactory(List<ClaimProcessor> processorList) {
    this.processors = processorList.stream()
        .collect(Collectors.toMap(ClaimProcessor::getSupportedType, Function.identity()));
    // Spring auto-registers HOME, HEALTH, VEHICLE processors
    // Adding TRAVEL: new @Component — this constructor runs identically
}
```

Three processors included: `HomeClaimProcessor` (80% coverage ratio),
`HealthClaimProcessor` ($200 excess), `VehicleClaimProcessor` (75% total loss threshold).

---

## Automated Testing

### Unit Tests — no Spring context, no database, no network

**`pattern/ConfigurationManagerTest.java`**
- `getInstance()` always returns the SAME object reference
- Thread safety — 50 concurrent threads all get the same instance
- `set()` and `get()` work correctly
- `get()` with default returns default when key not found
- `getInt()` parses integer values correctly
- `getInt()` returns default when value is not a valid integer
- `set()` with blank key throws IllegalArgumentException
- Default configuration values are loaded on startup

**`service/ClaimDomainTest.java`** — Builder + State Machine
- Builder creates a valid Claim with all mandatory fields
- Builder throws when policyId is blank — fail fast
- Builder throws when amount is negative
- Builder throws when policyHolder is null
- Health claim Builder throws when description is missing
- Health claim with description builds successfully
- SUBMITTED → UNDER_REVIEW is a valid transition
- UNDER_REVIEW → APPROVED is a valid transition
- APPROVED → PAID is a valid transition
- SUBMITTED → APPROVED is INVALID — must go through UNDER_REVIEW
- REJECTED claim cannot transition to any state — terminal
- PAID claim cannot transition — terminal state
- lastUpdatedAt is updated on every transition

**`service/ClaimsServiceTest.java`** — Mockito
- Successfully submits a valid claim
- Throws IllegalArgumentException when validation fails
- Successfully approves a claim and sends notification
- Throws ClaimNotFoundException when claim does not exist
- Approval succeeds even when notification fails — non-fatal
- Successfully rejects a submitted claim
- Returns claim when found
- Throws ClaimNotFoundException when not found

---

### Integration Tests — real dependencies

**`controller/ClaimsControllerTest.java`** — `@WebMvcTest`

Loads: real Spring MVC, real security filter chain, real `@PreAuthorize`.
Does not load: service implementations (mocked with `@MockBean`), database.

- Returns 200 with claim details for authenticated CLAIMS_PROCESSOR
- Returns 401 when no JWT provided
- Returns 403 when JWT has wrong role
- Returns 404 when claim not found
- Returns 201 Created for valid claim submission
- Returns 400 when amount is negative — `@Valid` catches it
- Returns 400 when policyId is missing
- Returns 200 when CLAIMS_PROCESSOR approves a claim
- Returns 403 when CLAIMS_VIEWER tries to approve

**`repository/ClaimRepositoryTest.java`** — Testcontainers PostgreSQL

```
WHY TESTCONTAINERS INSTEAD OF H2?
H2 does not support PostgreSQL-specific SQL syntax. Custom JPQL queries,
JSON operators, PostgreSQL functions would fail silently in H2 but fail in production.
Testcontainers runs the SAME PostgreSQL version as production.

@DynamicPropertySource overrides spring.datasource.* at runtime with the container URL.
Production DB URL is NEVER used. Container is destroyed after all tests complete.
```

- Should save and retrieve a claim with all fields
- `findByPolicyId()` returns all claims for a policy
- `findByStatus()` returns only claims with the given status
- `findByAmountRangeAndStatus()` returns claims in the specified range
- `countByStatus()` returns correct count

Coverage gate: **80% line coverage** enforced by JaCoCo — build fails below threshold.

---

## Security (DevSecOps)

File: `config/SecurityConfig.java`

```
DevSecOps demonstrated:
 - JWT-based stateless authentication (no sessions — STATELESS session policy)
 - Method-level RBAC via @PreAuthorize (see ClaimsController)
 - Health/readiness endpoints public (for k8s liveness probes)
 - All other endpoints require authenticated JWT
 - Roles extracted from JWT 'roles' claim and mapped to Spring GrantedAuthority
```

```
PRODUCTION SETUP:
  spring.security.oauth2.resourceserver.jwt.issuer-uri=https://identity.allianz.com/realms/allianz
  Spring fetches the public key from the Keycloak JWKS endpoint automatically.

TEST SETUP:
  spring.security.oauth2.resourceserver.jwt.public-key-location=classpath:test-public.pem
  Tests sign JWTs with the matching test-private.pem — no real Keycloak needed.
```

OWASP Dependency-Check configured in `pom.xml` — CVSS ≥ 7 fails the build:
```xml
<configuration>
    <failBuildOnCVSS>7</failBuildOnCVSS>
    <suppressionFile>owasp-suppressions.xml</suppressionFile>
</configuration>
```

Secrets never in code — injected via AWS Secrets Manager ARN into ECS task definitions:
```json
"secrets": [
  { "name": "DB_PASSWORD",
    "valueFrom": "arn:aws:secretsmanager:ap-southeast-2:123:secret:prod/db" }
]
```

---

## Build & Dependencies

### Java Version
- **Current:** Java 17 LTS
- **Minimum:** Java 17
- **Why LTS?** Long-term support, widely available, stable production runtime

Configured in `pom.xml`:
```xml
<properties>
    <java.version>17</java.version>
</properties>
```

### Key Dependencies
- **Spring Boot 3.2.0** — microservice framework
- **Spring Data JPA** — ORM layer with Hibernate
- **H2 Database** — in-memory database for local development (NEW)
- **PostgreSQL Driver** — production database connectivity
- **Flyway** — database migration versioning system
- **Spring Security + OAuth2** — JWT-based stateless authentication
- **Testcontainers** — containerized PostgreSQL for integration tests
- **JaCoCo** — code coverage reporting (80% line coverage enforced)

### Maven Build
```bash
# Clean build with tests (default profile)
mvn clean install

# Build with local profile (no PostgreSQL required)
mvn clean install -Dspring.profiles.active=local

# Build without tests
mvn clean install -DskipTests

# Generate coverage report
mvn jacoco:report
# View at: target/site/jacoco/index.html
```

---

## Running the Project

The application supports two profiles:

### Local Profile (H2 in-memory)

**Configuration file:** `src/main/resources/application-local.properties`

```properties
spring.datasource.url=jdbc:h2:mem:claimsdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=
spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=update
spring.flyway.enabled=false
```

**Use case:** Local development, IDE debugging, unit testing. No external dependencies required.

### Default Profile (PostgreSQL)

**Configuration file:** `src/main/resources/application.properties`

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/claims
spring.datasource.username=claims_user
spring.datasource.password=claims_pass
#spring.flyway.enabled=true  (default)
```

**Use case:** Production, integration testing with Testcontainers. Flyway manages database migrations.

---

## Running the Project

### Prerequisites
- Java 17 LTS (or higher)
- Docker (Testcontainers integration tests)
- Maven 3.9+

### Run locally

**Option 1: Local development with H2 in-memory database (recommended — no external dependencies)**
```bash
# Uses application-local.properties profile
# H2 in-memory database, Flyway disabled, Hibernate DDL auto-update

mvn spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=local"
# OR from IDE: Run Configuration → VM options → -Dspring.profiles.active=local
```

The application starts on `http://localhost:8080`.

**Option 2: Production setup with PostgreSQL (requires Docker)**
```bash
# Start PostgreSQL container
docker run -d --name claims-db \
  -e POSTGRES_DB=claims \
  -e POSTGRES_USER=claims_user \
  -e POSTGRES_PASSWORD=claims_pass \
  -p 5432:5432 postgres:15-alpine

# Run with default profile
mvn spring-boot:run
# OR from IDE: Run Configuration → No VM options (uses default profile)
```

The application starts on `http://localhost:8080`.

**Profile details:**
- **local** (`application-local.properties`): H2 in-memory, `jdbc:h2:mem:claimsdb`, Flyway disabled
- **default** (`application.properties`): PostgreSQL at `localhost:5432`, Flyway migrations enabled

### Run tests

```bash
# Unit tests only — no Docker required
mvn test -Dtest="**/service/**,**/pattern/**"

# All tests including Testcontainers (Docker required)
mvn verify

# Coverage report
open target/site/jacoco/index.html
```

### Running tests in IntelliJ / Troubleshooting

If you run a single JUnit test from IntelliJ and see an error like:

```
org.junit.platform.commons.PreconditionViolationException: Could not load class with name: com.allianz.claims.controller.ClaimsControllerTest
Caused by: java.lang.ClassNotFoundException: com.allianz.claims.controller.ClaimsControllerTest
```

follow these steps — IntelliJ sometimes misses the Maven-generated test output or uses the wrong module classpath:

1. Re-import the Maven project
   - Open the **Maven** tool window (View → Tool Windows → Maven). Click the "Reload All Maven Projects" button.

2. Ensure the Project SDK is set to Java 17
   - File → Project Structure → Project → Project SDK: select Java 17 (or the JDK set in `pom.xml`).

3. Build tests via Maven (reliable)

```bash
# From the project root
mvn test-compile
# or run the tests directly
mvn -Dtest=ClaimsControllerTest test
```

4. Check your JUnit Run Configuration
   - Edit Configurations → select the JUnit run config →
     - Ensure **Use classpath of module** is set to the module that contains the tests (the project module, e.g. `claims-service` or `claims-service.test`), not an unrelated module.
     - Make sure the **Before launch** steps include **Build** / **Make** (or enable "Delegate IDE build/run actions to Maven" in Settings → Build Tools → Maven → Runner).

5. If IntelliJ still cannot find the test class
   - Invalidate caches: File → Invalidate Caches / Restart → Invalidate and Restart.
   - After restart re-import the Maven project (step 1) and Build Project (Build → Build Project).

6. Alternative (guaranteed): run tests with Maven from the terminal (see step 3). The Maven run uses `target/test-classes` and reproduces CI behaviour.


---

## API Endpoints

| Method | Path | Role | Description |
|---|---|---|---|
| `POST` | `/api/v1/claims` | CLAIMS_SUBMITTER | Submit a new claim |
| `GET` | `/api/v1/claims/{id}` | CLAIMS_PROCESSOR, CLAIMS_VIEWER | Get claim by ID |
| `GET` | `/api/v1/claims` | CLAIMS_PROCESSOR, CLAIMS_VIEWER | List claims (paginated) |
| `GET` | `/api/v1/claims/policy/{policyId}` | CLAIMS_PROCESSOR, CLAIMS_VIEWER | Claims by policy |
| `PUT` | `/api/v1/claims/{id}/approve` | CLAIMS_PROCESSOR | Approve a claim |
| `PUT` | `/api/v1/claims/{id}/reject` | CLAIMS_PROCESSOR | Reject a claim |

Authentication: Bearer JWT. Roles from `roles` claim mapped to `ROLE_*` authorities.

---

## Quick Reference — Interview Questions

**"Show me SRP"**
→ `ClaimsController` — HTTP only, zero business logic, zero try/catch.
→ `GlobalExceptionHandler` — exception mapping only, zero controller logic.
→ `AuditLogListener` — audit logging only. Does not notify, calculate, or persist.

**"Show me OCP"**
→ `ClaimProcessorFactory` — add TRAVEL: one new `@Component`. Nothing else changes.
→ `NotificationStrategy` — add WhatsApp: one new `@Component`. Nothing else changes.
→ `ClaimEventPublisher` — add FraudCheckListener: one new `@Component`. Nothing else changes.

**"Show me LSP"**
→ `NotificationStrategy.notify()` — CONTRACT declared on the interface.
→ `EmailNotificationStrategy` — labelled LSP COMPLIANT. Delivers. Never a no-op.
→ Silent implementation counter-example documented in the interface javadoc.

**"Show me ISP"**
→ `NotificationStrategy` — one method. `ClaimEventListener` — one method. `ClaimProcessor` — focused on its type.
→ No client forced to stub unused methods.

**"Show me DIP"**
→ `ClaimsService` constructor — four interface parameters, zero concrete class imports.
→ Spring resolves `NotificationStrategy` to `EmailNotificationStrategy` at runtime.

**"Show me DRY"**
→ `findClaimById()` — one private method used in four service methods.
→ `canTransitionTo()` — transition rules in one enum method, never duplicated.
→ `ClaimResponse.from()` — DTO mapping in one place for all five endpoints.
→ `ErrorResponse` record — error format defined once, used in five handlers.
→ `maskPhone()` — masking logic in one place, one change applies everywhere.

**"Show me Composition over Inheritance"**
→ `CompositionOverInheritanceDemo.java` — wrong approach (inheritance, commented out)
   vs right approach (composition) side by side.
→ `NotificationStrategy.java` — has-a relationship documented with explicit before/after.
→ `ClaimsService` has-a `NotificationStrategy`, has-a `ClaimProcessor` — no base classes,
   no super() calls, each collaborator independently testable and swappable at runtime.
