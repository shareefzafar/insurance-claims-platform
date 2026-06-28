package com.allianz.claims.controller;

import com.allianz.claims.domain.ClaimStatus;
import com.allianz.claims.domain.PolicyHolder;
import com.allianz.claims.dto.request.CreateClaimRequest;
import com.allianz.claims.dto.response.ClaimResponse;
import com.allianz.claims.repository.PolicyHolderRepository;
import com.allianz.claims.service.ClaimsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

/**
 * ClaimsController — HTTP layer only.
 *
 * SRP: This class handles ONLY HTTP concerns:
 *  - URL mapping
 *  - Request/response serialisation
 *  - HTTP status codes
 *  - Authentication principal extraction
 *
 * ZERO business logic here — all delegated to ClaimsService.
 * ZERO try/catch here — GlobalExceptionHandler handles all exceptions.
 *
 * SECURITY:
 *  @PreAuthorize enforces method-level RBAC using JWT roles.
 *  Roles come from the 'roles' claim in the JWT.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/claims")
@RequiredArgsConstructor
public class ClaimsController {

    private final ClaimsService           claimsService;
    private final PolicyHolderRepository  policyHolderRepository;

    // ── SUBMIT CLAIM ──────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasRole('CLAIMS_SUBMITTER') or hasRole('CLAIMS_PROCESSOR')")
    public ResponseEntity<ClaimResponse> submitClaim(
            @Valid @RequestBody CreateClaimRequest request,
            @AuthenticationPrincipal Jwt jwt) {

        // Extract policy holder from JWT subject
        String holderId = jwt.getSubject();
        PolicyHolder holder = policyHolderRepository.findById(holderId)
            .orElseThrow(() -> new IllegalArgumentException("Policy holder not found: " + holderId));

        ClaimResponse response = claimsService.submitClaim(request, holder);

        // 201 Created with Location header pointing to the new resource
        URI location = URI.create("/api/v1/claims/" + response.claimId());
        return ResponseEntity.created(location).body(response);
    }

    // ── GET CLAIM ─────────────────────────────────────────────────────────

    @GetMapping("/{claimId}")
    @PreAuthorize("hasRole('CLAIMS_PROCESSOR') or hasRole('CLAIMS_VIEWER')")
    public ResponseEntity<ClaimResponse> getClaim(@PathVariable String claimId) {
        return ResponseEntity.ok(claimsService.getClaim(claimId));
        // ClaimNotFoundException → 404 via GlobalExceptionHandler
    }

    // ── LIST BY STATUS ────────────────────────────────────────────────────

    @GetMapping
    @PreAuthorize("hasRole('CLAIMS_PROCESSOR') or hasRole('CLAIMS_VIEWER')")
    public ResponseEntity<Page<ClaimResponse>> getClaims(
            @RequestParam(required = false) ClaimStatus status,
            Pageable pageable) {

        // Defaults to all SUBMITTED claims if status not provided
        ClaimStatus filter = status != null ? status : ClaimStatus.SUBMITTED;
        return ResponseEntity.ok(claimsService.getClaimsByStatus(filter, pageable));
    }

    // ── CLAIMS BY POLICY ──────────────────────────────────────────────────

    @GetMapping("/policy/{policyId}")
    @PreAuthorize("hasRole('CLAIMS_PROCESSOR') or hasRole('CLAIMS_VIEWER')")
    public ResponseEntity<List<ClaimResponse>> getClaimsByPolicy(
            @PathVariable String policyId) {
        return ResponseEntity.ok(claimsService.getClaimsByPolicy(policyId));
    }

    // ── APPROVE CLAIM ─────────────────────────────────────────────────────

    @PutMapping("/{claimId}/approve")
    @PreAuthorize("hasRole('CLAIMS_PROCESSOR')")
    public ResponseEntity<ClaimResponse> approveClaim(
            @PathVariable String claimId,
            @AuthenticationPrincipal Jwt jwt) {

        String approvedBy = jwt.getClaimAsString("email");
        return ResponseEntity.ok(claimsService.approveClaim(claimId, approvedBy));
    }

    // ── REJECT CLAIM ──────────────────────────────────────────────────────

    @PutMapping("/{claimId}/reject")
    @PreAuthorize("hasRole('CLAIMS_PROCESSOR')")
    public ResponseEntity<ClaimResponse> rejectClaim(
            @PathVariable String claimId,
            @AuthenticationPrincipal Jwt jwt) {

        String rejectedBy = jwt.getClaimAsString("email");
        return ResponseEntity.ok(claimsService.rejectClaim(claimId, rejectedBy));
    }
}
