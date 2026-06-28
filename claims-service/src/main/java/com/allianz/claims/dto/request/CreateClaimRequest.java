package com.allianz.claims.dto.request;

import com.allianz.claims.domain.ClaimType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

/**
 * CreateClaimRequest — inbound DTO.
 *
 * @Valid on the controller parameter triggers Bean Validation automatically.
 * GlobalExceptionHandler catches MethodArgumentNotValidException and returns 400.
 */
@Data
public class CreateClaimRequest {

    @NotBlank(message = "policyId is required")
    private String policyId;

    @NotNull(message = "amount is required")
    @Positive(message = "amount must be positive")
    private BigDecimal amount;

    @NotNull(message = "claim type is required")
    private ClaimType type;

    private String description;

    private String supportingDocumentUrl;
}
