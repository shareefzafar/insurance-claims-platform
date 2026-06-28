package com.insureco.claims;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Claims Microservice — Entry Point
 *
 * Demonstrates:
 *  - SOLID principles throughout all layers
 *  - DRY — shared validation, abstract base classes
 *  - Composition over Inheritance — Strategy pattern for notifications
 *  - Design Patterns — Singleton, Strategy, Builder, Observer, Factory
 *  - Spring Boot REST API with OAuth2/JWT security
 *  - Automated testing — unit, integration, @WebMvcTest
 */
@SpringBootApplication
public class ClaimsServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(ClaimsServiceApplication.class, args);
    }
}
