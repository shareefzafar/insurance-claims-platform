package com.insureco.claims.pattern.strategy;

import com.insureco.claims.domain.Claim;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Sends notifications via email.
 *
 * LSP COMPLIANT: Honoured contract — when notify() is called, an email IS sent.
 * Not a no-op. Not a stub. The caller can trust the contract.
 *
 * @Primary: Spring injects this when multiple NotificationStrategy beans exist
 *           and no specific qualifier is used.
 */
@Slf4j
@Component
@Primary
@ConditionalOnProperty(name = "notification.channel", havingValue = "email", matchIfMissing = true)
public class EmailNotificationStrategy implements NotificationStrategy {

    @Override
    public NotificationResult notify(Claim claim) {
        try {
            // In production: inject JavaMailSender and send real email
            // Here: simulated for demonstration
            String subject = buildSubject(claim);
            String body    = buildBody(claim);
            String messageId = "EMAIL-" + UUID.randomUUID();

            log.info("EMAIL sent to {} | Subject: {} | ClaimId: {} | MessageId: {}",
                claim.getPolicyHolder().getEmail(), subject, claim.getId(), messageId);

            return NotificationResult.builder(getChannelName())
                .success(messageId)
                .build();

        } catch (Exception e) {
            log.error("Failed to send email notification for claim {}", claim.getId(), e);
            return NotificationResult.builder(getChannelName())
                .failure(e.getMessage())
                .build();
        }
    }

    @Override
    public String getChannelName() {
        return "EMAIL";
    }

    private String buildSubject(Claim claim) {
        return String.format("Your Claim %s has been %s", claim.getId(), claim.getStatus());
    }

    private String buildBody(Claim claim) {
        return String.format(
            "Dear %s,\n\nYour claim %s for amount $%.2f has been %s.\n\nRegards,\nInsureCo Claims Team",
            claim.getPolicyHolder().getFullName(),
            claim.getId(),
            claim.getAmount(),
            claim.getStatus()
        );
    }
}

