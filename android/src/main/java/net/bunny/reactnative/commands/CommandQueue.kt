package net.bunny.reactnative.commands

/**
 * Commands that target the player instance and depend on `STATE_READY`.
 *
 * `setVolume` and `setPlaybackRate` are NOT here — they target the
 * `DefaultBunnyPlayer` singleton directly and are always executable
 * (the singleton is available after `BunnyStreamApi.initialize`).
 */
sealed class PlayerCommand {
  /** Resume playback. */
  object Play : PlayerCommand()

  /** Pause playback. */
  object Pause : PlayerCommand()

  /** Seek to [positionMs] (milliseconds, non-negative). */
  data class SeekTo(val positionMs: Long) : PlayerCommand()
}

/**
 * Command queue with a ready-gate.
 *
 * Semantics (plan section 5):
 * - Before `STATE_READY`, `Play`/`Pause`/`SeekTo` are enqueued and held.
 * - When [setReady]`true` is called, the queue is drained in FIFO order.
 * - When [reset] is called (source change or cleanup), the queue is cleared
 *   and the ready flag is dropped, so stale commands from a previous source
 *   never execute against the new one.
 *
 * `setVolume` and `setPlaybackRate` bypass this queue entirely — they are
 * applied to the `DefaultBunnyPlayer` singleton immediately, regardless of
 * ready state, because the singleton is available after `initialize`.
 *
 * Not thread-safe; intended for UI-thread use only.
 */
class CommandQueue(
  private val executor: (PlayerCommand) -> Unit,
) {
  private val pending = mutableListOf<PlayerCommand>()
  private var ready = false

  /**
   * Enqueues [cmd] if not ready, or executes immediately if ready.
   */
  fun enqueue(cmd: PlayerCommand) {
    if (ready) {
      executor(cmd)
    } else {
      pending.add(cmd)
    }
  }

  /**
   * Sets the ready state. When transitioning to `true`, drains all pending
   * commands in FIFO order. When transitioning to `false`, only the flag
   * is updated (pending commands are preserved).
   */
  fun setReady(value: Boolean) {
    if (value == ready) return
    ready = value
    if (ready) drain()
  }

  /**
   * Clears all pending commands and resets the ready flag.
   * Called on source change or cleanup.
   */
  fun reset() {
    pending.clear()
    ready = false
  }

  /** Returns `true` if there are no pending commands. */
  fun isEmpty(): Boolean = pending.isEmpty()

  private fun drain() {
    val commands = pending.toList()
    pending.clear()
    commands.forEach(executor)
  }
}
