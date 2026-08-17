package net.bunny.reactnative.commands

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Unit tests for [CommandQueue].
 *
 * Pure JVM tests — no Android dependencies. Verifies the ready-gate
 * semantics: enqueue-while-not-ready, drain-on-ready, reset-on-source-change.
 */
class CommandQueueTest {

  @Test
  fun `enqueue before ready holds command`() {
    val executed = mutableListOf<PlayerCommand>()
    val queue = CommandQueue { executed.add(it) }

    queue.enqueue(PlayerCommand.Play)

    assertFalse(queue.isEmpty(), "Pending list should contain the held command")
    assertTrue(executed.isEmpty(), "Command should not execute before ready")
  }

  @Test
  fun `setReady true drains pending commands in FIFO order`() {
    val executed = mutableListOf<PlayerCommand>()
    val queue = CommandQueue { executed.add(it) }

    queue.enqueue(PlayerCommand.Play)
    queue.enqueue(PlayerCommand.SeekTo(1000))
    queue.enqueue(PlayerCommand.Pause)

    queue.setReady(true)

    assertEquals(3, executed.size)
    assertEquals(PlayerCommand.Play, executed[0])
    assertEquals(PlayerCommand.SeekTo(1000), executed[1])
    assertEquals(PlayerCommand.Pause, executed[2])
  }

  @Test
  fun `enqueue after ready executes immediately`() {
    val executed = mutableListOf<PlayerCommand>()
    val queue = CommandQueue { executed.add(it) }

    queue.setReady(true)
    queue.enqueue(PlayerCommand.Play)

    assertEquals(1, executed.size)
    assertEquals(PlayerCommand.Play, executed[0])
  }

  @Test
  fun `setReady true with no pending commands is no-op`() {
    val executed = mutableListOf<PlayerCommand>()
    val queue = CommandQueue { executed.add(it) }

    queue.setReady(true)

    assertTrue(executed.isEmpty())
  }

  @Test
  fun `setReady true twice does not re-drain`() {
    val executed = mutableListOf<PlayerCommand>()
    val queue = CommandQueue { executed.add(it) }

    queue.enqueue(PlayerCommand.Play)
    queue.setReady(true)
    assertEquals(1, executed.size)

    queue.setReady(true) // no-op
    assertEquals(1, executed.size)
  }

  @Test
  fun `reset clears pending commands and drops ready flag`() {
    val executed = mutableListOf<PlayerCommand>()
    val queue = CommandQueue { executed.add(it) }

    queue.enqueue(PlayerCommand.Play)
    queue.enqueue(PlayerCommand.Pause)
    queue.reset()

    assertTrue(queue.isEmpty())
    queue.setReady(true) // should not drain anything
    assertTrue(executed.isEmpty())
  }

  @Test
  fun `reset after ready allows new commands to be queued`() {
    val executed = mutableListOf<PlayerCommand>()
    val queue = CommandQueue { executed.add(it) }

    queue.setReady(true)
    queue.enqueue(PlayerCommand.Play)
    assertEquals(1, executed.size)

    queue.reset()
    queue.enqueue(PlayerCommand.Pause)
    assertTrue(executed.size == 1, "After reset, new commands should be held again")
    queue.setReady(true)
    assertEquals(2, executed.size)
    assertEquals(PlayerCommand.Pause, executed[1])
  }

  @Test
  fun `setReady false preserves pending commands`() {
    val executed = mutableListOf<PlayerCommand>()
    val queue = CommandQueue { executed.add(it) }

    queue.setReady(true)
    queue.setReady(false)
    queue.enqueue(PlayerCommand.Play)

    assertTrue(queue.isEmpty().not(), "Pending command should be held when not ready")
    queue.setReady(true)
    assertEquals(1, executed.size)
  }

  @Test
  fun `SeekTo with different positions are distinct commands`() {
    val executed = mutableListOf<PlayerCommand>()
    val queue = CommandQueue { executed.add(it) }

    queue.enqueue(PlayerCommand.SeekTo(1000))
    queue.enqueue(PlayerCommand.SeekTo(2000))
    queue.setReady(true)

    assertEquals(2, executed.size)
    assertEquals(1000L, (executed[0] as PlayerCommand.SeekTo).positionMs)
    assertEquals(2000L, (executed[1] as PlayerCommand.SeekTo).positionMs)
  }

  @Test
  fun `isEmpty returns true for fresh queue`() {
    val queue = CommandQueue { }
    assertTrue(queue.isEmpty())
  }

  @Test
  fun `isEmpty returns false when commands are pending`() {
    val queue = CommandQueue { }
    queue.enqueue(PlayerCommand.Play)
    assertFalse(queue.isEmpty())
  }
}
