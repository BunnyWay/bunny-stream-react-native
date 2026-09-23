import type { AndroidConfig } from '@expo/config-plugins';

import { describe, expect, it } from '@jest/globals';

import {
  ensureKotlinGradlePluginVersion,
  applyBunnyStreamAndroidManifest,
  applyBunnyStreamGradleProperties,
  compareVersions,
  ensureCoreLibraryDesugaring,
  mergeConfigChanges,
} from '../android';
import {
  applyBunnyStreamInfoPlist,
  EMBED_PHASE_NAME,
  ensureEmbedSwiftPmFrameworksPhase,
} from '../ios';
import { patchSpmRb } from '../spm';
import { resolvePluginProps } from '../types';

const defaultProps = resolvePluginProps();

describe('mergeConfigChanges', () => {
  it('adds all required flags to an empty value', () => {
    const merged = mergeConfigChanges(undefined).split('|');
    for (const flag of [
      'keyboard',
      'keyboardHidden',
      'orientation',
      'screenLayout',
      'screenSize',
      'smallestScreenSize',
      'uiMode',
    ]) {
      expect(merged).toContain(flag);
    }
  });

  it('unions with existing flags without duplicating', () => {
    const merged = mergeConfigChanges('orientation|screenSize|density');
    expect(merged.split('|')).toContain('density');
    expect(merged.match(/orientation/g)).toHaveLength(1);
  });
});

describe('applyBunnyStreamAndroidManifest', () => {
  type AndroidManifest = Parameters<typeof AndroidConfig.Permissions.ensurePermissions>[0];
  const makeManifest = (): AndroidManifest => ({
    manifest: {
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
      'uses-permission': [],
      queries: [],
      application: [
        {
          $: { 'android:name': '.MainApplication' },
          activity: [
            {
              $: {
                'android:name': '.MainActivity',
                'android:configChanges': 'orientation|screenSize',
              },
            },
          ],
        },
      ],
    },
  });

  it('adds camera/mic permissions and PiP flags', () => {
    const manifest = makeManifest();
    applyBunnyStreamAndroidManifest(manifest, defaultProps);

    const permissions = manifest.manifest['uses-permission']!.map((p) => p.$['android:name']);
    expect(permissions).toContain('android.permission.CAMERA');
    expect(permissions).toContain('android.permission.RECORD_AUDIO');

    const activity = manifest.manifest.application![0]!.activity![0]!.$;
    expect(activity['android:supportsPictureInPicture']).toBe('true');
    expect(activity['android:configChanges']).toContain('smallestScreenSize');
  });

  it('is idempotent', () => {
    const manifest = makeManifest();
    applyBunnyStreamAndroidManifest(manifest, defaultProps);
    applyBunnyStreamAndroidManifest(manifest, defaultProps);
    expect(manifest.manifest['uses-permission']).toHaveLength(2);
  });

  it('skips PiP flags when disabled', () => {
    const manifest = makeManifest();
    applyBunnyStreamAndroidManifest(manifest, {
      ...defaultProps,
      enablePictureInPicture: false,
    });
    const activity = manifest.manifest.application![0]!.activity![0]!.$;
    expect(activity['android:supportsPictureInPicture']).toBeUndefined();
  });
});

describe('ensureCoreLibraryDesugaring', () => {
  const base = 'android {\n    compileOptions {\n    }\n}\ndependencies {\n}\n';

  it('appends desugaring blocks when missing', () => {
    const out = ensureCoreLibraryDesugaring(base, '2.1.5');
    expect(out).toContain('coreLibraryDesugaringEnabled true');
    expect(out).toContain('coreLibraryDesugaring "com.android.tools:desugar_jdk_libs:2.1.5"');
  });

  it('is idempotent', () => {
    const once = ensureCoreLibraryDesugaring(base, '2.1.5');
    expect(ensureCoreLibraryDesugaring(once, '2.1.5')).toBe(once);
  });
});

describe('applyBunnyStreamGradleProperties', () => {
  it('sets minSdk and kotlin floors when absent', () => {
    const items = applyBunnyStreamGradleProperties([]);
    expect(items).toContainEqual({
      type: 'property',
      key: 'android.minSdkVersion',
      value: '26',
    });
    expect(items).toContainEqual({
      type: 'property',
      key: 'android.kotlinVersion',
      value: '2.2.20',
    });
  });

  it('raises lower values but never lowers higher ones', () => {
    const items = applyBunnyStreamGradleProperties([
      { type: 'property', key: 'android.minSdkVersion', value: '24' },
      { type: 'property', key: 'android.kotlinVersion', value: '2.3.0' },
    ]);
    expect(items.find((i) => i.key === 'android.minSdkVersion')?.value).toBe('26');
    expect(items.find((i) => i.key === 'android.kotlinVersion')?.value).toBe('2.3.0');
  });
});

describe('ensureKotlinGradlePluginVersion', () => {
  const expoTemplate = `buildscript {
  dependencies {
    classpath('com.android.tools.build:gradle')
    classpath('com.facebook.react:react-native-gradle-plugin')
    classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')
  }
}`;

  it('pins the versionless Expo classpath entry', () => {
    const out = ensureKotlinGradlePluginVersion(expoTemplate, '2.2.20');
    expect(out).toContain("classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.20')");
    expect(out).toContain('com.facebook.react:react-native-gradle-plugin');
  });

  it('raises a lower pinned version and keeps a higher one', () => {
    const lower = `classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.1.0")`;
    const higher = `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.3.0')`;
    expect(ensureKotlinGradlePluginVersion(lower, '2.2.20')).toContain(
      'kotlin-gradle-plugin:2.2.20',
    );
    expect(ensureKotlinGradlePluginVersion(higher, '2.2.20')).toContain(
      'kotlin-gradle-plugin:2.3.0',
    );
  });

  it('leaves unrelated build files untouched', () => {
    expect(ensureKotlinGradlePluginVersion('buildscript {}', '2.2.20')).toBe('buildscript {}');
  });
});

describe('compareVersions', () => {
  it('compares dotted versions numerically', () => {
    expect(compareVersions('0.87.9', '0.88.0')).toBeLessThan(0);
    expect(compareVersions('0.88.0', '0.88.0')).toBe(0);
    expect(compareVersions('2.2.20', '2.2.9')).toBeGreaterThan(0);
  });
});

describe('applyBunnyStreamInfoPlist', () => {
  it('sets usage descriptions and the audio background mode', () => {
    const plist = applyBunnyStreamInfoPlist({} as Record<string, unknown>, defaultProps);
    expect(plist['NSCameraUsageDescription']).toBeTruthy();
    expect(plist['NSMicrophoneUsageDescription']).toBeTruthy();
    expect(plist['UIBackgroundModes']).toEqual(['audio']);
    expect(plist['NSPhotoLibraryUsageDescription']).toBeUndefined();
  });

  it('respects opt-outs and preserves existing modes', () => {
    const plist = applyBunnyStreamInfoPlist(
      { UIBackgroundModes: ['fetch'] } as Record<string, unknown>,
      {
        ...defaultProps,
        cameraPermission: false,
        photoLibraryPermission: 'Pick a video',
      },
    );
    expect(plist['NSCameraUsageDescription']).toBeUndefined();
    expect(plist['NSPhotoLibraryUsageDescription']).toBe('Pick a video');
    expect(plist['UIBackgroundModes']).toEqual(['fetch', 'audio']);
  });
});

describe('patchSpmRb', () => {
  const fixture = [
    '    def add_spm_to_target(project, pkg_class, ref_class)',
    '        pkg = project.new(pkg_class)',
    '        ref = project.new(ref_class)',
    '    end',
    '',
    '    private',
    '',
    '    def other_helper',
    '    end',
  ].join('\n');

  it('inserts new_object and reroutes project.new calls', () => {
    const { source, changed } = patchSpmRb(fixture);
    expect(changed).toBe(true);
    expect(source).toContain('def new_object(project, klass)');
    expect(source).toContain('pkg = new_object(project, pkg_class)');
    expect(source).toContain('ref = new_object(project, ref_class)');
  });

  it('is idempotent', () => {
    const once = patchSpmRb(fixture);
    expect(patchSpmRb(once.source).changed).toBe(false);
  });

  it('leaves unrecognised layouts untouched', () => {
    expect(patchSpmRb('def unrelated\nend\n').changed).toBe(false);
  });
});

describe('ensureEmbedSwiftPmFrameworksPhase', () => {
  function fakeProject() {
    const objects: Record<string, Record<string, Record<string, unknown>>> = {
      PBXShellScriptBuildPhase: {},
      PBXNativeTarget: {
        appTarget: { productType: '"com.apple.product-type.application"' },
      },
    };
    const added: Array<Record<string, unknown>> = [];
    return {
      objects,
      added,
      project: {
        getFirstTarget: () => ({ uuid: 'appTarget' }),
        addBuildPhase: (
          _files: string[],
          type: string,
          comment: string,
          _target: string,
          options?: Record<string, unknown>,
        ) => {
          const uuid = `phase${added.length}`;
          objects.PBXShellScriptBuildPhase![uuid] = { isa: type, name: `"${comment}"`, ...options };
          added.push(objects.PBXShellScriptBuildPhase![uuid]!);
        },
        hash: { project: { objects } },
      },
    };
  }

  it('adds the embed phase with the copy script', () => {
    const { project } = fakeProject();
    ensureEmbedSwiftPmFrameworksPhase(project);
    const phase = Object.values(project.hash.project.objects.PBXShellScriptBuildPhase!)[0]!;
    expect(phase.name).toBe(`"${EMBED_PHASE_NAME}"`);
    expect(phase.shellScript as string).toContain('GoogleInteractiveMediaAds.framework');
    expect(phase.shellScript as string).not.toContain('\n');
    expect(phase.shellPath).toBe('/bin/sh');
  });

  it('refreshes an existing phase instead of duplicating', () => {
    const { objects, project } = fakeProject();
    objects.PBXShellScriptBuildPhase!['existing'] = {
      name: `"${EMBED_PHASE_NAME}"`,
      shellScript: '"old"',
    };
    ensureEmbedSwiftPmFrameworksPhase(project);
    expect(Object.keys(objects.PBXShellScriptBuildPhase!)).toHaveLength(1);
    expect(objects.PBXShellScriptBuildPhase!['existing']!.shellScript).not.toBe('"old"');
  });
});
