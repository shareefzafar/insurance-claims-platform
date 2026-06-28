package com.insureco.claims.repository;

import com.insureco.claims.domain.Claim;
import com.insureco.claims.domain.ClaimStatus;
import com.insureco.claims.domain.ClaimType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

/**
 * ClaimRepository — Spring Data JPA.
 *
 * DIP: ClaimsService depends on this interface, not its JPA implementation.
 * In tests: replaced by Testcontainers PostgreSQL or @DataJpaTest in-memory.
 */
@Repository
public interface ClaimRepository extends JpaRepository<Claim, String> {

    // Spring Data derives query from method name — zero SQL needed
    List<Claim> findByPolicyId(String policyId);

    Page<Claim> findByStatus(ClaimStatus status, Pageable pageable);

    List<Claim> findByTypeAndStatus(ClaimType type, ClaimStatus status);

    // Custom JPQL query for amount range
    @Query("SELECT c FROM Claim c WHERE c.amount BETWEEN :min AND :max AND c.status = :status")
    List<Claim> findByAmountRangeAndStatus(
        @Param("min") BigDecimal min,
        @Param("max") BigDecimal max,
        @Param("status") ClaimStatus status
    );

    // Count by status — useful for dashboard metrics
    long countByStatus(ClaimStatus status);
}
