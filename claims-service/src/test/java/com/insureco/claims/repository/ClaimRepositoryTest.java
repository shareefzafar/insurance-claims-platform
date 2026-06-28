package com.insureco.claims.repository;

import com.insureco.claims.domain.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Disabled;

/**
 * ClaimRepository Integration Test — Testcontainers PostgreSQL
 *
 * WHY TESTCONTAINERS INSTEAD OF H2?
 *  H2 does not support PostgreSQL-specific SQL syntax.
 *  Custom JPQL queries, JSON operators, PostgreSQL functions would fail silently in H2
 *  but fail in production. Testcontainers runs the SAME PostgreSQL version as production.
 *
 * WHAT TESTCONTAINERS DOES:
 *  1. Starts a fresh PostgreSQL Docker container when the test class loads (@Container static)
 *  2. @DynamicPropertySource overrides spring.datasource.* at runtime with container URL
 *  3. Spring Boot connects to the container — NOT to any real database
 *  4. JPA creates schema (ddl-auto=create-drop in test profile)
 *  5. Each @Test runs in a transaction that ROLLS BACK after completion
 *  6. Container is destroyed after all tests complete
 *
 * RESULT: Production is never touched. Tests are isolated and repeatable.
 *
 * @AutoConfigureTestDatabase(replace = NONE):
 *  By default @DataJpaTest replaces the datasource with H2.
 *  replace=NONE tells Spring to use OUR datasource (Testcontainers).
 */
@DataJpaTest
@ActiveProfiles("test")
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@DisplayName("ClaimRepository — Testcontainers PostgreSQL Integration Tests")
@Disabled("Requires Docker to be installed. Testcontainers cannot connect to Docker daemon.")
class ClaimRepositoryTest {

    // static: container started ONCE for all tests in this class (not per test)
    // Container is shared — much faster than starting a new one per test
    @Container
    static PostgreSQLContainer<?> postgres =
        new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName("claims_test")
            .withUsername("test_user")
            .withPassword("test_pass");

    /**
     * Override Spring datasource properties with Testcontainers URL.
     * This completely replaces the URL from application.properties.
     * Production DB URL is NEVER used in tests.
     */
    @DynamicPropertySource
    static void overrideProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",      postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired ClaimRepository       claimRepository;
    @Autowired PolicyHolderRepository policyHolderRepository;

    private PolicyHolder savedHolder;

    @BeforeEach
    void setUp() {
        // Each test starts with a fresh holder
        PolicyHolder holder = new PolicyHolder(
            "Mohammad Zafar", "zafar@insureco.com",
            "+61400000000", "S1234567D", LocalDate.of(1985, 1, 1)
        );
        savedHolder = policyHolderRepository.save(holder);
    }

    @Test
    @DisplayName("Should save and retrieve a claim with all fields")
    void shouldSaveAndRetrieveClaim() {
        // ARRANGE
        Claim claim = Claim.builder("POL-001", BigDecimal.valueOf(750), ClaimType.HOME, savedHolder)
            .description("Roof water damage")
            .build();

        // ACT
        Claim saved = claimRepository.save(claim);
        Claim found = claimRepository.findById(saved.getId()).orElseThrow();

        // ASSERT — tests real PostgreSQL persistence
        assertThat(found.getPolicyId()).isEqualTo("POL-001");
        assertThat(found.getAmount()).isEqualByComparingTo("750");
        assertThat(found.getType()).isEqualTo(ClaimType.HOME);
        assertThat(found.getStatus()).isEqualTo(ClaimStatus.SUBMITTED);
        assertThat(found.getDescription()).isEqualTo("Roof water damage");
        assertThat(found.getPolicyHolder().getEmail()).isEqualTo("zafar@insureco.com");
        assertThat(found.getSubmittedAt()).isNotNull();
    }

    @Test
    @DisplayName("findByPolicyId() returns all claims for a policy")
    void shouldFindByPolicyId() {
        // ARRANGE — save two claims for POL-001, one for POL-002
        claimRepository.save(Claim.builder("POL-001", BigDecimal.valueOf(500), ClaimType.HOME, savedHolder).build());
        claimRepository.save(Claim.builder("POL-001", BigDecimal.valueOf(300), ClaimType.VEHICLE, savedHolder).build());
        claimRepository.save(Claim.builder("POL-002", BigDecimal.valueOf(200), ClaimType.HEALTH, savedHolder)
            .description("Hospital visit").build());

        // ACT
        List<Claim> pol001Claims = claimRepository.findByPolicyId("POL-001");

        // ASSERT
        assertThat(pol001Claims).hasSize(2);
        assertThat(pol001Claims).allMatch(c -> c.getPolicyId().equals("POL-001"));
    }

    @Test
    @DisplayName("findByStatus() returns only claims with the given status")
    void shouldFindByStatus() {
        // ARRANGE
        claimRepository.save(Claim.builder("POL-001", BigDecimal.valueOf(500), ClaimType.HOME, savedHolder).build());
        claimRepository.save(Claim.builder("POL-002", BigDecimal.valueOf(300), ClaimType.VEHICLE, savedHolder).build());

        // ACT
        var submitted = claimRepository.findByStatus(ClaimStatus.SUBMITTED,
            org.springframework.data.domain.Pageable.unpaged());

        // ASSERT — both are SUBMITTED (initial status)
        assertThat(submitted.getContent()).hasSize(2);
        assertThat(submitted.getContent()).allMatch(c -> c.getStatus() == ClaimStatus.SUBMITTED);
    }

    @Test
    @DisplayName("findByAmountRangeAndStatus() returns claims in the specified range")
    void shouldFindByAmountRangeAndStatus() {
        // ARRANGE
        claimRepository.save(Claim.builder("POL-001", BigDecimal.valueOf(100),  ClaimType.VEHICLE, savedHolder).build());
        claimRepository.save(Claim.builder("POL-002", BigDecimal.valueOf(500),  ClaimType.HOME, savedHolder).build());
        claimRepository.save(Claim.builder("POL-003", BigDecimal.valueOf(1000), ClaimType.HOME, savedHolder).build());

        // ACT — find claims between $200 and $800
        List<Claim> inRange = claimRepository.findByAmountRangeAndStatus(
            BigDecimal.valueOf(200), BigDecimal.valueOf(800), ClaimStatus.SUBMITTED);

        // ASSERT — only the $500 claim is in range
        assertThat(inRange).hasSize(1);
        assertThat(inRange.get(0).getAmount()).isEqualByComparingTo("500");
    }

    @Test
    @DisplayName("countByStatus() returns correct count")
    void shouldCountByStatus() {
        // ARRANGE
        claimRepository.save(Claim.builder("POL-001", BigDecimal.valueOf(500), ClaimType.HOME, savedHolder).build());
        claimRepository.save(Claim.builder("POL-002", BigDecimal.valueOf(300), ClaimType.HEALTH, savedHolder)
            .description("Medical").build());

        // ACT
        long count = claimRepository.countByStatus(ClaimStatus.SUBMITTED);

        // ASSERT
        assertThat(count).isEqualTo(2);
    }
}
