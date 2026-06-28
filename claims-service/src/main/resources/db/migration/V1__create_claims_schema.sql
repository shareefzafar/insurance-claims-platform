-- V1__create_claims_schema.sql
-- Flyway versioned migration — runs automatically on startup
-- Production: against real PostgreSQL
-- Tests: Testcontainers PostgreSQL or ddl-auto=create-drop

CREATE TABLE IF NOT EXISTS policy_holders (
    id            VARCHAR(36)  PRIMARY KEY,
    full_name     VARCHAR(200) NOT NULL,
    email         VARCHAR(200) NOT NULL UNIQUE,
    phone_number  VARCHAR(20)  NOT NULL,
    nric          VARCHAR(20)  NOT NULL,
    date_of_birth DATE         NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
    id                      VARCHAR(36)    PRIMARY KEY,
    policy_id               VARCHAR(50)    NOT NULL,
    amount                  DECIMAL(15, 2) NOT NULL,
    type                    VARCHAR(20)    NOT NULL,
    policy_holder_id        VARCHAR(36)    NOT NULL REFERENCES policy_holders(id),
    status                  VARCHAR(20)    NOT NULL DEFAULT 'SUBMITTED',
    description             VARCHAR(1000),
    supporting_document_url VARCHAR(500),
    submitted_at            TIMESTAMP      NOT NULL,
    last_updated_at         TIMESTAMP,
    reviewed_by             VARCHAR(200),

    CONSTRAINT fk_claim_holder
        FOREIGN KEY (policy_holder_id) REFERENCES policy_holders(id)
);

-- Index for common queries
CREATE INDEX idx_claims_policy_id   ON claims(policy_id);
CREATE INDEX idx_claims_status      ON claims(status);
CREATE INDEX idx_claims_type_status ON claims(type, status);
