package net.bunny.reactnative.commands

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * Unit tests for [GenerationToken].
 *
 * Pure JVM tests — verifies monotonic increment and stale-generation
 * invalidation semantics.
 */
class GenerationTokenTest {

  @Test
  fun `fresh token starts at generation 0`() {
    val token = GenerationToken()
    assertTrue(token.isActive(0L))
  }

  @Test
  fun `bump increments generation and invalidates previous`() {
    val token = GenerationToken()
    val gen0 = token.current()

    token.bump()

    assertFalse(token.isActive(gen0))
    assertTrue(token.isActive(gen0 + 1))
  }

  @Test
  fun `multiple bumps produce strictly increasing generations`() {
    val token = GenerationToken()
    val gen0 = token.current()
    val gen1 = token.bump()
    val gen2 = token.bump()
    val gen3 = token.bump()

    assertTrue(gen1 > gen0)
    assertTrue(gen2 > gen1)
    assertTrue(gen3 > gen2)
    assertTrue(token.isActive(gen3))
    assertFalse(token.isActive(gen2))
  }

  @Test
  fun `isActive returns false for generation never seen`() {
    val token = GenerationToken()
    assertFalse(token.isActive(99L))
  }

  @Test
  fun `two independent tokens do not interfere`() {
    val a = GenerationToken()
    val b = GenerationToken()

    a.bump()

    assertTrue(b.isActive(0L), "Token b should be unaffected by token a's bump")
    assertFalse(a.isActive(0L), "Token a should have invalidated gen 0")
  }

  @Test
  fun `bump returns new generation value`() {
    val token = GenerationToken()
    val before = token.current()
    val after = token.bump()

    assertNotEquals(before, after)
    assertTrue(after > before)
  }
}
