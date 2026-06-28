package com.allianz.claims.pattern.singleton;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * SINGLETON PATTERN — Thread-Safe ConfigurationManager
 *
 * Demonstrates TWO thread-safe singleton implementations:
 *
 * 1. Bill Pugh (Static Inner Class) — PREFERRED
 *    - Lazy initialisation guaranteed by JVM class loading
 *    - No synchronisation overhead on every getInstance() call
 *    - JVM guarantees class initialisation is thread-safe
 *
 * 2. Double-Checked Locking — shown for interview awareness
 *    - volatile keyword prevents instruction reordering
 *    - synchronized block prevents race condition on first creation
 *    - Without volatile: thread B can see a partially constructed instance
 *
 * WHY NOT JUST USE @Component?
 *   In Spring, beans are singleton-scoped by default.
 *   This class exists to DEMONSTRATE the pattern for interviews.
 *   In production Spring code you would use @Component + @Bean.
 *
 * INTERVIEW QUESTION: "Why is volatile needed in double-checked locking?"
 *   Without volatile, the JVM can reorder instructions.
 *   new ConfigurationManager() involves:
 *     1. Allocate memory
 *     2. Initialise the object
 *     3. Assign reference to instance
 *   JVM can reorder to: 1 → 3 → 2
 *   Thread B sees instance != null (step 3 done) but the object
 *   is not yet fully initialised (step 2 not done yet).
 *   volatile forces happens-before ordering: all writes before
 *   the assignment are visible to any thread that reads instance.
 */
public class ConfigurationManager {

    // ── APPROACH 1: BILL PUGH (PREFERRED) ─────────────────────────────────
    // The Holder class is only loaded when getInstance() is called.
    // JVM guarantees class loading is atomic and thread-safe — no locks needed.
    // Lazy: ConfigurationManager class loads, but INSTANCE is not created
    //        until Holder is loaded, which only happens on first getInstance().

    private static class Holder {
        private static final ConfigurationManager INSTANCE = new ConfigurationManager();
        // ^ Created exactly once. Thread-safe. No synchronisation overhead.
    }

    public static ConfigurationManager getInstance() {
        return Holder.INSTANCE;
        // This is the preferred approach — clean, simple, correct.
    }

    // ── APPROACH 2: DOUBLE-CHECKED LOCKING (FOR AWARENESS) ────────────────
    // Shown here so you can explain it in interviews.
    // volatile: ensures changes are visible across all threads immediately.
    // Without volatile: thread A may write a half-constructed object to the
    // field, thread B sees instance != null and returns a broken object.

    private static volatile ConfigurationManager doubleCheckedInstance;

    public static ConfigurationManager getInstanceDCL() {
        if (doubleCheckedInstance == null) {             // First check — no lock (fast path)
            synchronized (ConfigurationManager.class) {
                if (doubleCheckedInstance == null) {     // Second check — with lock (safe)
                    doubleCheckedInstance = new ConfigurationManager();
                }
            }
        }
        return doubleCheckedInstance;
        // Why two checks?
        // If we only checked inside synchronized, every call acquires the lock — expensive.
        // The outer check skips locking for all calls AFTER the first initialisation.
        // The inner check prevents two threads that both passed the outer check from
        // both creating an instance.
    }

    // ── WRONG APPROACH (DO NOT USE) ───────────────────────────────────────
    // Shown here so you recognise the bug in interviews.
    //
    // private static ConfigurationManager wrong; // NOT volatile — broken
    // public static ConfigurationManager getInstanceWrong() {
    //     if (wrong == null) {              // Thread A checks: null
    //         wrong = new ConfigurationManager(); // Thread B also sees null
    //     }                                // Thread B also creates instance!
    //     return wrong;                    // Two instances in memory — broken.
    // }

    // ── INSTANCE DATA ──────────────────────────────────────────────────────
    // ConcurrentHashMap for thread-safe reads and writes without global locking
    private final Map<String, String> config = new ConcurrentHashMap<>();

    // Private constructor — prevents external instantiation
    private ConfigurationManager() {
        loadDefaults();
    }

    private void loadDefaults() {
        config.put("app.name",              "claims-service");
        config.put("app.version",           "1.0.0");
        config.put("claims.max.amount",     "1000000");
        config.put("notification.retries",  "3");
        config.put("notification.timeout",  "5000");
    }

    // ── PUBLIC API ─────────────────────────────────────────────────────────

    public void set(String key, String value) {
        if (key == null || key.isBlank())
            throw new IllegalArgumentException("Config key cannot be blank");
        config.put(key, value);
    }

    public String get(String key) {
        return config.get(key);
    }

    public String get(String key, String defaultValue) {
        return config.getOrDefault(key, defaultValue);
    }

    public int getInt(String key, int defaultValue) {
        String value = config.get(key);
        if (value == null) return defaultValue;
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    public boolean contains(String key) {
        return config.containsKey(key);
    }

    public int size() {
        return config.size();
    }
}
