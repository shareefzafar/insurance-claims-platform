package com.allianz.claims.domain;

public enum ClaimType {
    HOME, HEALTH, VEHICLE
    // OCP: Add TRAVEL, LIFE etc here.
    // Each new value needs a new ClaimProcessor @Component — nothing else changes.
}
