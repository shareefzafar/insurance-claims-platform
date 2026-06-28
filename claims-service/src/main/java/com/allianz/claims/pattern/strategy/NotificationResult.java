package com.allianz.claims.pattern.strategy;

import java.time.LocalDateTime;

/**
 * Immutable result object returned by every NotificationStrategy.
 * Builder pattern used for construction.
 */
public final class NotificationResult {

    private final boolean success;
    private final String  messageId;
    private final String  channel;
    private final String  errorMessage;
    private final LocalDateTime sentAt;

    private NotificationResult(Builder builder) {
        this.success      = builder.success;
        this.messageId    = builder.messageId;
        this.channel      = builder.channel;
        this.errorMessage = builder.errorMessage;
        this.sentAt       = builder.sentAt;
    }

    public static Builder builder(String channel) {
        return new Builder(channel);
    }

    public boolean isSuccess()       { return success; }
    public String  getMessageId()    { return messageId; }
    public String  getChannel()      { return channel; }
    public String  getErrorMessage() { return errorMessage; }
    public LocalDateTime getSentAt() { return sentAt; }

    public static class Builder {
        private final String channel;
        private boolean      success;
        private String       messageId;
        private String       errorMessage;
        private LocalDateTime sentAt = LocalDateTime.now();

        private Builder(String channel) {
            if (channel == null || channel.isBlank())
                throw new IllegalArgumentException("channel is required");
            this.channel = channel;
        }

        public Builder success(String messageId) {
            this.success   = true;
            this.messageId = messageId;
            return this;
        }

        public Builder failure(String errorMessage) {
            this.success      = false;
            this.errorMessage = errorMessage;
            return this;
        }

        public NotificationResult build() {
            return new NotificationResult(this);
        }
    }

    @Override
    public String toString() {
        return "NotificationResult{channel=" + channel +
               ", success=" + success +
               ", messageId=" + messageId + "}";
    }
}
