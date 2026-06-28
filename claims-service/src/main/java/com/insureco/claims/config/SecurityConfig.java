package com.insureco.claims.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Security Configuration — OAuth2 JWT Resource Server
 *
 * DevSecOps demonstrated:
 *  - JWT-based stateless authentication (no sessions — SESSION_CREATION_POLICY.STATELESS)
 *  - Method-level RBAC via @PreAuthorize (see ClaimsController)
 *  - Health/readiness endpoints public (for k8s liveness probes)
 *  - All other endpoints require authenticated JWT
 *  - Roles extracted from JWT 'roles' claim and mapped to Spring GrantedAuthority
 *
 * PRODUCTION SETUP:
 *  application.properties:
 *    spring.security.oauth2.resourceserver.jwt.issuer-uri=https://identity.insureco.com/realms/insureco
 *  Spring fetches the public key from the Keycloak JWKS endpoint automatically.
 *
 * TEST SETUP:
 *  application-test.properties:
 *    spring.security.oauth2.resourceserver.jwt.public-key-location=classpath:test-public.pem
 *  Tests sign JWTs with the matching test-private.pem — no real Keycloak needed.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity // enables @PreAuthorize on controller methods
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            // CSRF disabled — stateless REST API with JWT does not need CSRF tokens
            .csrf(AbstractHttpConfigurer::disable)

            // Stateless — no HTTP sessions created or used
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // URL-level authorisation
            .authorizeHttpRequests(auth -> auth
                // Health and readiness endpoints — public (for Kubernetes probes)
                .requestMatchers("/actuator/health/**").permitAll()
                .requestMatchers("/actuator/info").permitAll()
                // All other endpoints require a valid JWT
                .anyRequest().authenticated()
            )

            // OAuth2 JWT Resource Server — validates JWT signature, expiry, issuer
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
            )

            .build();
    }

    /**
     * Extracts roles from the 'roles' claim in the JWT and maps them to
     * Spring Security GrantedAuthority objects with ROLE_ prefix.
     *
     * JWT payload example:
     * {
     *   "sub": "user-id-123",
     *   "email": "officer@insureco.com",
     *   "roles": ["CLAIMS_PROCESSOR", "CLAIMS_VIEWER"]
     * }
     *
     * @PreAuthorize("hasRole('CLAIMS_PROCESSOR')") checks for ROLE_CLAIMS_PROCESSOR
     */
    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            @SuppressWarnings("unchecked")
            List<String> roles = (List<String>) jwt.getClaims().get("roles");
            if (roles == null) return List.of();
            return roles.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .collect(Collectors.toList());
        });
        return converter;
    }
}
