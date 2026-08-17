package net.bunny.reactnative.ownership

import java.util.concurrent.atomic.AtomicReference

/**
 * Ownership lease for the `DefaultBunnyPlayer` singleton.
 *
 * The SDK's `DefaultBunnyPlayer` is a singleton with a single `playerStateListener`
 * slot occupied by the native UI. Only one RN wrapper view can be the active
 * owner at a time. This lease centralises that constraint:
 *
 * - [acquire] is called when a wrapper view mounts. If a previous lease exists,
 *   its [onRevoke] callback is invoked, which triggers the old view's cleanup.
 * - [release] is called when the current owner unmounts. It is idempotent:
 *   calling it multiple times or on a stale lease is a no-op.
 * - The current lease is held in an [AtomicReference] so that acquire/revoke
 *   are atomic even if two views mount near-simultaneously.
 *
 * The lease does NOT call `DefaultBunnyPlayer.release()` — the singleton lifetime
 * is tied to the `BunnyStreamApi` instance, not to individual views. The lease
 * only governs which view receives events and commands.
 */
class BunnyPlayerLease(
  private val onRevoke: () -> Unit,
) {
  /** Unique identity for this lease, used to detect stale releases. */
  val id: Long = nextId()

  /**
   * Attempts to acquire ownership. If another lease is active, its [onRevoke]
   * is called before this lease becomes the new owner.
   *
   * Returns `true` if this lease is now the active owner.
   */
  fun acquire(): Boolean {
    while (true) {
      val current = activeLease.get()
      if (current != null && current !== this) {
        current.onRevoke()
      }
      if (activeLease.compareAndSet(current, this)) {
        return true
      }
    }
  }

  /**
   * Releases ownership, but only if this lease is still the active one.
   * Stale releases (after a newer lease has already taken over) are no-ops.
   *
   * Idempotent: safe to call multiple times.
   */
  fun release() {
    activeLease.compareAndSet(this, null)
  }

  companion object {
    private val activeLease = AtomicReference<BunnyPlayerLease?>(null)
    private var idCounter = 0L

    private fun nextId(): Long = synchronized(Companion) {
      idCounter++
    }

    /** Returns the currently active lease, or `null` if none. */
    fun activeOwner(): BunnyPlayerLease? = activeLease.get()
  }
}
