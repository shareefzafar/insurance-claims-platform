package com.allianz.claims.exception;

public class ClaimNotFoundException extends RuntimeException {
    public ClaimNotFoundException(String claimId) {
        super("Claim not found: " + claimId);
    }
}
