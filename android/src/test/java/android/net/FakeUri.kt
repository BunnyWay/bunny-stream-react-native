package android.net

import android.os.Parcel

/**
 * Bare-minimum [Uri] subclass for plain-JVM unit tests.
 *
 * `Uri()` is package-private, so a fake must live in the `android.net`
 * package — the same trick the framework's own `StubUri` plays (that class
 * is not in the compile-time android.jar, so tests declare their own).
 * Only the identity string matters: `DataSpec` stores the `uri` field and
 * never calls methods on it. `returnDefaultValues` in the module's
 * `testOptions` keeps the stub base-class constructor from throwing.
 */
internal class FakeUri(private val value: String) : Uri() {
  override fun toString() = value
  override fun isHierarchical() = true
  override fun isOpaque() = false
  override fun isRelative() = false
  override fun getScheme() = "https"
  override fun getEncodedSchemeSpecificPart() = value.substringAfter("https:")
  override fun getSchemeSpecificPart() = value.substringAfter("https:")
  override fun getAuthority() = value.substringAfter("https://").substringBefore("/")
  override fun getEncodedAuthority() = value.substringAfter("https://").substringBefore("/")
  override fun getPath() = "/${value.substringAfter("https://").substringAfter("/", "")}"
  override fun getEncodedPath() = getPath()
  override fun getUserInfo(): String? = null
  override fun getEncodedUserInfo(): String? = null
  override fun getHost() = getAuthority()
  override fun getPort() = -1
  override fun getQuery(): String? = null
  override fun getEncodedQuery(): String? = null
  override fun getFragment(): String? = null
  override fun getEncodedFragment(): String? = null
  override fun getPathSegments(): List<String> = emptyList()
  override fun getLastPathSegment(): String? = null
  override fun buildUpon(): Uri.Builder = throw UnsupportedOperationException()
  override fun describeContents() = 0
  override fun writeToParcel(dest: Parcel, flags: Int) = Unit
}
