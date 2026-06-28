package com.allianz.claims.repository;

import com.allianz.claims.domain.PolicyHolder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PolicyHolderRepository extends JpaRepository<PolicyHolder, String> {
    java.util.Optional<PolicyHolder> findByEmail(String email);
}
