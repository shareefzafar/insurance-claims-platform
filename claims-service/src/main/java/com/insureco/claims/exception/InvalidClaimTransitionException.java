package com.insureco.claims.exception;

public class InvalidClaimTransitionException extends RuntimeException {
    public InvalidClaimTransitionException(String message) {
        super(message);
    }
}
