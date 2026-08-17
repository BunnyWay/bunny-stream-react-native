package net.bunny.reactnative.ownership

import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Unit tests for [BunnyPlayerLease].
 *
 * Pure JVM tests — verifies single-active-instance ownership, revocation
 * of previous lease on acquire, and idempotent release semantics.
 *
 * NOTE: [BunnyPlayerLease] uses a global [AtomicReference] in its companion
 * object, so tests share state. Each test cleans up by releasing the active
 * lease in [AfterTest].
 */
class BunnyPlayerLeaseTest {

  @AfterTest
  fun cleanup() {
    BunnyPlayerLease.activeOwner()?.release()
  }

  @Test
  fun `acquire makes lease the active owner`() {
    var revoked = false
    val lease = BunnyPlayerLease { revoked = true }

    val acquired = lease.acquire()

    assertTrue(acquired)
    assertEquals(lease.id, BunnyPlayerLease.activeOwner()?.id)
    assertFalse(revoked, "No previous lease to revoke")
    lease.release()
  }

  @Test
  fun `acquiring a new lease revokes the previous one`() {
    var firstRevoked = false
    var secondRevoked = false
    val first = BunnyPlayerLease { firstRevoked = true }
    val second = BunnyPlayerLease { secondRevoked = true }

    first.acquire()
    second.acquire()

    assertTrue(firstRevoked, "First lease should have been revoked")
    assertFalse(secondRevoked, "Second lease should not be revoked yet")
    assertEquals(second.id, BunnyPlayerLease.activeOwner()?.id)
    second.release()
  }

  @Test
  fun `release clears the active owner`() {
    val lease = BunnyPlayerLease { }

    lease.acquire()
    lease.release()

    assertNull(BunnyPlayerLease.activeOwner())
  }

  @Test
  fun `release is idempotent`() {
    val lease = BunnyPlayerLease { }

    lease.acquire()
    lease.release()
    lease.release() // should not throw

    assertNull(BunnyPlayerLease.activeOwner())
  }

  @Test
  fun `release on a stale lease is a no-op`() {
    var firstRevoked = false
    var secondRevoked = false
    val first = BunnyPlayerLease { firstRevoked = true }
    val second = BunnyPlayerLease { secondRevoked = true }

    first.acquire()
    second.acquire()

    // first was already revoked by second's acquire; releasing it should not
    // clear the active owner (which is now second).
    first.release()

    assertEquals(second.id, BunnyPlayerLease.activeOwner()?.id)
    assertFalse(secondRevoked)
    second.release()
  }

  @Test
  fun `activeOwner returns null when no lease is active`() {
    assertNull(BunnyPlayerLease.activeOwner())
  }

  @Test
  fun `each lease has a unique id`() {
    val a = BunnyPlayerLease { }
    val b = BunnyPlayerLease { }

    assertNotEquals(a.id, b.id)
  }
}
