package com.allianz.claims.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Global exception handler — SRP applied to error handling.
 *
 * All exception-to-HTTP-response mapping lives HERE, not in controllers.
 * Controllers have zero try/catch blocks — they focus only on HTTP concerns.
 *
 * DRY: Error response format is defined once in ErrorResponse — used everywhere.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    // ── VALIDATION ERRORS (400) ───────────────────────────────────────────

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        List<ErrorResponse.FieldViolation> violations = ex.getBindingResult()
            .getFieldErrors()
            .stream()
            .map(e -> new ErrorResponse.FieldViolation(e.getField(), e.getDefaultMessage()))
            .collect(Collectors.toList());

        return ResponseEntity
            .badRequest()
            .body(ErrorResponse.validationFailed(violations));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity
            .badRequest()
            .body(ErrorResponse.of("BAD_REQUEST", ex.getMessage()));
    }

    // ── NOT FOUND (404) ──────────────────────────────────────────────────

    @ExceptionHandler(ClaimNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ClaimNotFoundException ex) {
        return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse.of("NOT_FOUND", ex.getMessage()));
    }

    // ── BUSINESS RULE VIOLATIONS (422) ───────────────────────────────────

    @ExceptionHandler(InvalidClaimTransitionException.class)
    public ResponseEntity<ErrorResponse> handleInvalidTransition(InvalidClaimTransitionException ex) {
        return ResponseEntity
            .status(HttpStatus.UNPROCESSABLE_ENTITY)
            .body(ErrorResponse.of("INVALID_TRANSITION", ex.getMessage()));
    }

    // ── UNEXPECTED ERRORS (500) ──────────────────────────────────────────

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneral(Exception ex) {
        log.error("Unexpected error", ex);
        // Never expose internal error details to clients — security best practice
        return ResponseEntity
            .internalServerError()
            .body(ErrorResponse.of("INTERNAL_ERROR", "An unexpected error occurred"));
    }


    // ── ERROR RESPONSE DTO ────────────────────────────────────────────────

    public record ErrorResponse(
        String code,
        String message,
        List<FieldViolation> violations,
        LocalDateTime timestamp
    ) {
        public static ErrorResponse of(String code, String message) {
            return new ErrorResponse(code, message, List.of(), LocalDateTime.now());
        }

        public static ErrorResponse validationFailed(List<FieldViolation> violations) {
            return new ErrorResponse(
                "VALIDATION_FAILED",
                "Request validation failed",
                violations,
                LocalDateTime.now()
            );
        }

        public record FieldViolation(String field, String message) {}
    }
}
