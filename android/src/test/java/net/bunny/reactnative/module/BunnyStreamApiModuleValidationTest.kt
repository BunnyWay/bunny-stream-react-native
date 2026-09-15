package net.bunny.reactnative.module

import java.io.ByteArrayInputStream
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

class BunnyStreamApiModuleValidationTest {

  @Test
  fun `accepts supported image content types for file and content URIs`() {
    val contentTypes = listOf("image/jpeg", "image/png", "image/webp", "image/gif")

    for (contentType in contentTypes) {
      assertNull(
        BunnyStreamApiModule.thumbnailUploadValidationError(
          "content://media/external/images/42",
          contentType,
        ),
      )
      assertNull(
        BunnyStreamApiModule.thumbnailUploadValidationError(
          "file:///storage/emulated/0/Pictures/thumbnail.jpg",
          contentType,
        ),
      )
    }
  }

  @Test
  fun `rejects unsupported content type`() {
    val error = BunnyStreamApiModule.thumbnailUploadValidationError(
      "content://media/external/images/42",
      "application/octet-stream",
    )

    assertEquals(
      "Unsupported live stream thumbnail content type: application/octet-stream",
      error,
    )
  }

  @Test
  fun `rejects non local URI schemes and bare paths`() {
    val remoteError = BunnyStreamApiModule.thumbnailUploadValidationError(
      "https://example.com/thumbnail.jpg",
      "image/jpeg",
    )
    val barePathError = BunnyStreamApiModule.thumbnailUploadValidationError(
      "/storage/emulated/0/Pictures/thumbnail.jpg",
      "image/jpeg",
    )

    assertTrue(remoteError.orEmpty().contains("file or content scheme"))
    assertTrue(barePathError.orEmpty().contains("file or content scheme"))
  }

  @Test
  fun `reads thumbnail bytes within the configured limit`() {
    val bytes = byteArrayOf(1, 2, 3, 4)

    assertContentEquals(
      bytes,
      BunnyStreamApiModule.readThumbnailBytes(ByteArrayInputStream(bytes), maxBytes = 4),
    )
  }

  @Test
  fun `rejects thumbnail bytes above the configured limit`() {
    val error = assertFailsWith<IllegalArgumentException> {
      BunnyStreamApiModule.readThumbnailBytes(
        ByteArrayInputStream(byteArrayOf(1, 2, 3, 4, 5)),
        maxBytes = 4,
      )
    }

    assertTrue(error.message.orEmpty().contains("4 byte limit"))
  }

  @Test
  fun `URI scheme matching is case insensitive`() {
    assertNull(
      BunnyStreamApiModule.thumbnailUploadValidationError(
        "CONTENT://media/external/images/42",
        "image/png",
      ),
    )
  }
}
