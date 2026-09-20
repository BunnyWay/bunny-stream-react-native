import type { ResolvedBunnyStreamPluginProps } from './types';

import { AndroidConfig } from '@expo/config-plugins';

const REQUIRED_CONFIG_CHANGES = [
  'keyboard',
  'keyboardHidden',
  'orientation',
  'screenLayout',
  'screenSize',
  'smallestScreenSize',
  'uiMode',
];

const REQUIRED_PERMISSIONS = ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'];

/** Android SDK requires API 26+; the Kotlin metadata in SDK 4.0.0 needs >= 2.2.20. */
const MIN_SDK_VERSION = '26';
export const MIN_KOTLIN_VERSION = '2.2.20';

export function mergeConfigChanges(existing: string | undefined): string {
  const current = new Set(
    (existing ?? '')
      .split('|')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  for (const change of REQUIRED_CONFIG_CHANGES) {
    current.add(change);
  }
  return [...current].join('|');
}

type AndroidManifest = Parameters<typeof AndroidConfig.Permissions.ensurePermissions>[0];

export function applyBunnyStreamAndroidManifest(
  manifest: AndroidManifest,
  props: Pick<ResolvedBunnyStreamPluginProps, 'enablePictureInPicture'>,
): AndroidManifest {
  AndroidConfig.Permissions.ensurePermissions(manifest, REQUIRED_PERMISSIONS);

  if (props.enablePictureInPicture) {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    mainActivity.$['android:supportsPictureInPicture'] = 'true';
    mainActivity.$['android:configChanges'] = mergeConfigChanges(
      mainActivity.$['android:configChanges'],
    );
  }

  return manifest;
}

/**
 * Enables core library desugaring in the app module. The Bunny Stream Android
 * SDK pulls media3-exoplayer-ima / interactivemedia, which rely on desugared
 * java.time APIs — desugaring must be enabled per-Gradle-module, so the
 * library's own setting does not cover the app. Appending a second
 * `android {}` / `dependencies {}` block is legal Gradle and keeps this
 * idempotent without parsing the existing build script.
 */
export function ensureCoreLibraryDesugaring(
  buildGradle: string,
  desugarJdkLibsVersion: string,
): string {
  let result = buildGradle;
  if (!result.includes('coreLibraryDesugaringEnabled')) {
    result +=
      '\nandroid {\n' +
      '    compileOptions {\n' +
      '        // Required by the Bunny Stream Android SDK (media3 / IMA).\n' +
      '        coreLibraryDesugaringEnabled true\n' +
      '    }\n' +
      '}\n';
  }
  if (!/coreLibraryDesugaring[\s("]/.test(result)) {
    result +=
      '\ndependencies {\n' +
      `    coreLibraryDesugaring "com.android.tools:desugar_jdk_libs:${desugarJdkLibsVersion}"\n` +
      '}\n';
  }
  return result;
}

type GradlePropertyItem = {
  type: string;
  key?: string;
  value?: unknown;
};

/**
 * Expo templates declare `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')`
 * in the app buildscript *without* a version — it resolves transitively from
 * react-native-gradle-plugin (e.g. 2.1.x on RN 0.86). Subprojects then inherit
 * that compiler through the buildscript classloader, which cannot read the
 * Kotlin 2.3 metadata shipped by the Bunny Stream Android SDK's kotlin-stdlib.
 * Pinning the classpath to the minimum required version fixes it.
 */
export function ensureKotlinGradlePluginVersion(
  buildGradle: string,
  kotlinVersion: string,
): string {
  return buildGradle.replace(
    /classpath\(\s*['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin(?::([^'"]+))?['"]\s*\)/g,
    (match, existing: string | undefined) =>
      existing && compareVersions(existing, kotlinVersion) >= 0
        ? match
        : `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}')`,
  );
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function raiseGradleProperty(items: GradlePropertyItem[], key: string, minimum: string): void {
  const existing = items.find((item) => item.type === 'property' && item.key === key);
  if (!existing) {
    items.push({ type: 'property', key, value: minimum });
    return;
  }
  if (compareVersions(String(existing.value ?? '0'), minimum) < 0) {
    existing.value = minimum;
  }
}

/**
 * Sets the gradle.properties keys the Expo project template reads in
 * `android/build.gradle` (`findProperty('android.minSdkVersion')` /
 * `findProperty('android.kotlinVersion')` — the same keys
 * `expo-build-properties` writes). Only ever raises values, never lowers an
 * explicit consumer setting.
 */
export function applyBunnyStreamGradleProperties<T extends GradlePropertyItem[]>(items: T): T {
  raiseGradleProperty(items, 'android.minSdkVersion', MIN_SDK_VERSION);
  raiseGradleProperty(items, 'android.kotlinVersion', MIN_KOTLIN_VERSION);
  return items;
}
