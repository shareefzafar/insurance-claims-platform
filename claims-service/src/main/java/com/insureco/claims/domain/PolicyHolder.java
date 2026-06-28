package com.insureco.claims.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

/**
 * PolicyHolder — the person who holds the insurance policy.
 *
 * BUILDER PATTERN is on the Claim entity (the aggregate root).
 * PolicyHolder uses Lombok for brevity here.
 */
@Entity
@Table(name = "policy_holders")
@Getter
@NoArgsConstructor
public class PolicyHolder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String phoneNumber;

    @Column(nullable = false)
    private String nric; // National Registration ID

    @Column(nullable = false)
    private LocalDate dateOfBirth;

    public PolicyHolder(String fullName, String email, String phoneNumber,
                        String nric, LocalDate dateOfBirth) {
        this.fullName    = fullName;
        this.email       = email;
        this.phoneNumber = phoneNumber;
        this.nric        = nric;
        this.dateOfBirth = dateOfBirth;
    }
}
