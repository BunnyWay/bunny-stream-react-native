package net.bunny.reactnative.commands

import java.util.concurrent.atomic.AtomicLong

/**
 * Monotonic generation token used to cancel stale async work.
 *
 * The singleton `DefaultBunnyPlayer` loads video asynchronously. When `videoId`
 * changes rapidly (Fast Refresh, list recycling, prop updates), callbacks from
 * a previous load may arrive after a new source has already been requested.
 *
 * Pattern:
 * 1. Capture `gen = generation.get()` before starting async work.
 * 2. Before acting on a callback, check `generation.get() == gen`.
 * 3. On source change, call [bump] to invalidate all in-flight work from
 *    older generations.
 *
 * Thread-safe via [AtomicLong]. All reads/writes are on the UI thread in
 * practice, but the atomic guarantees visibility without volatile fences.
 */
class GenerationToken {
  private val value = AtomicLong(0L)

  /** Returns the current generation. */
  fun current(): Long = value.get()

  /**
   * Increments the generation, invalidating all work captured against
   * previous values. Returns the new generation.
   */
  fun bump(): Long = value.incrementAndGet()

  /**
   * Returns `true` if [gen] matches the current generation, meaning the
   * work associated with [gen] is still valid.
   */
  fun isActive(gen: Long): Boolean = value.get() == gen
}
