package com.insureco.claims.pattern.strategy;

import com.insureco.claims.domain.Claim;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.UUID;


// ─────────────────────────────────────────────────────────────────────────────
// SMS NOTIFICATION STRATEGY
// ─────────────────────────────────────────────────────────────────────────────

@Slf4j
@Component
@ConditionalOnProperty(name = "notification.channel", havingValue = "sms")
class SmsNotificationStrategy implements NotificationStrategy {

    @Override
    public NotificationResult notify(Claim claim) {
        try {
            String message   = buildSmsMessage(claim);
            String phone     = claim.getPolicyHolder().getPhoneNumber();
            String messageId = "SMS-" + UUID.randomUUID();

            // In production: inject Twilio or AWS SNS SMS client
            log.info("SMS sent to {} | Claim: {} | Status: {} | MessageId: {}",
                maskPhone(phone), claim.getId(), claim.getStatus(), messageId);

            return NotificationResult.builder(getChannelName())
                .success(messageId)
                .build();

        } catch (Exception e) {
            log.error("Failed to send SMS notification for claim {}", claim.getId(), e);
            return NotificationResult.builder(getChannelName())
                .failure(e.getMessage())
                .build();
        }
    }

    @Override
    public String getChannelName() {
        return "SMS";
    }

    private String buildSmsMessage(Claim claim) {
        return String.format("InsureCo: Claim %s status updated to %s. Amount: $%.2f",
            claim.getId(), claim.getStatus(), claim.getAmount());
    }

    // DRY: mask phone for logging — one place to change if masking rules change
    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return "****" + phone.substring(phone.length() - 4);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// SNS NOTIFICATION STRATEGY
// ─────────────────────────────────────────────────────────────────────────────

@Slf4j
@Component
@ConditionalOnProperty(name = "notification.channel", havingValue = "sns")
class SnsNotificationStrategy implements NotificationStrategy {

    @Override
    public NotificationResult notify(Claim claim) {
        try {
            String messageId = "SNS-" + UUID.randomUUID();
            String topicArn  = "arn:aws:sns:ap-southeast-2:123456789:claims-notifications";

            // In production: inject SnsClient from AWS SDK v2
            // snsClient.publish(PublishRequest.builder()
            //     .topicArn(topicArn)
            //     .message(buildSnsPayload(claim))
            //     .build());

            log.info("SNS published to {} | ClaimId: {} | Status: {} | MessageId: {}",
                topicArn, claim.getId(), claim.getStatus(), messageId);

            return NotificationResult.builder(getChannelName())
                .success(messageId)
                .build();

        } catch (Exception e) {
            log.error("Failed to publish SNS notification for claim {}", claim.getId(), e);
            return NotificationResult.builder(getChannelName())
                .failure(e.getMessage())
                .build();
        }
    }

    @Override
    public String getChannelName() {
        return "SNS";
    }

    private String buildSnsPayload(Claim claim) {
        return String.format(
            "{\"claimId\":\"%s\",\"status\":\"%s\",\"amount\":%.2f}",
            claim.getId(), claim.getStatus(), claim.getAmount()
        );
    }
}
