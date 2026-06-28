package com.allianz.claims.pattern;

import com.allianz.claims.pattern.singleton.ConfigurationManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * ConfigurationManager Singleton Tests
 *
 * Tests demonstrate:
 *  1. Single instance guarantee (same object reference)
 *  2. Thread safety under concurrent access (50 threads, no duplicate instances)
 *  3. Data read/write correctness
 *  4. Default value handling
 */
@DisplayName("Singleton Pattern — ConfigurationManager")
class ConfigurationManagerTest {

    @Test
    @DisplayName("getInstance() always returns the SAME object reference")
    void shouldReturnSameInstanceEveryTime() {
        ConfigurationManager instance1 = ConfigurationManager.getInstance();
        ConfigurationManager instance2 = ConfigurationManager.getInstance();
        ConfigurationManager instance3 = ConfigurationManager.getInstance();

        // Same object in memory — not just equal, but identical reference
        assertThat(instance1).isSameAs(instance2);
        assertThat(instance2).isSameAs(instance3);
    }

    @Test
    @DisplayName("Thread safety — 50 concurrent threads all get the same instance")
    void shouldBeThreadSafeUnder50ConcurrentThreads() throws InterruptedException {
        int threadCount = 50;
        CountDownLatch startLatch = new CountDownLatch(1);    // all threads start simultaneously
        CountDownLatch doneLatch  = new CountDownLatch(threadCount);

        // Collect instance identities from all threads
        Set<Integer> identityHashCodes = ConcurrentHashMap.newKeySet();

        for (int i = 0; i < threadCount; i++) {
            new Thread(() -> {
                try {
                    startLatch.await(); // wait for all threads to be ready
                    ConfigurationManager instance = ConfigurationManager.getInstance();
                    identityHashCodes.add(System.identityHashCode(instance));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    doneLatch.countDown();
                }
            }).start();
        }

        startLatch.countDown();          // release all 50 threads simultaneously
        doneLatch.await(5, TimeUnit.SECONDS);

        // All 50 threads got the SAME instance — only one identity hash code
        assertThat(identityHashCodes)
            .as("All threads must get the same singleton instance")
            .hasSize(1);
    }

    @Test
    @DisplayName("set() and get() work correctly")
    void shouldStoreAndRetrieveConfigValues() {
        ConfigurationManager config = ConfigurationManager.getInstance();

        config.set("test.key", "test-value");

        assertThat(config.get("test.key")).isEqualTo("test-value");
    }

    @Test
    @DisplayName("get() with default returns default when key not found")
    void shouldReturnDefaultWhenKeyNotFound() {
        ConfigurationManager config = ConfigurationManager.getInstance();

        String result = config.get("non.existent.key", "my-default");

        assertThat(result).isEqualTo("my-default");
    }

    @Test
    @DisplayName("getInt() parses integer values correctly")
    void shouldParseIntegerValues() {
        ConfigurationManager config = ConfigurationManager.getInstance();
        config.set("int.key", "42");

        assertThat(config.getInt("int.key", 0)).isEqualTo(42);
    }

    @Test
    @DisplayName("getInt() returns default when value is not a valid integer")
    void shouldReturnDefaultForInvalidInteger() {
        ConfigurationManager config = ConfigurationManager.getInstance();
        config.set("bad.int", "not-a-number");

        assertThat(config.getInt("bad.int", 99)).isEqualTo(99);
    }

    @Test
    @DisplayName("set() with blank key throws IllegalArgumentException")
    void shouldRejectBlankKey() {
        ConfigurationManager config = ConfigurationManager.getInstance();

        assertThatThrownBy(() -> config.set("", "value"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Config key cannot be blank");
    }

    @Test
    @DisplayName("Default configuration values are loaded on startup")
    void shouldHaveDefaultValues() {
        ConfigurationManager config = ConfigurationManager.getInstance();

        assertThat(config.get("app.name")).isEqualTo("claims-service");
        assertThat(config.get("claims.max.amount")).isEqualTo("1000000");
        assertThat(config.contains("notification.retries")).isTrue();
    }
}
