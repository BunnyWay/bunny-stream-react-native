import type { ConfigPlugin } from '@expo/config-plugins';

import { WarningAggregator, withDangerousMod } from '@expo/config-plugins';
import fs from 'node:fs';
import path from 'node:path';

import { compareVersions } from './android';

const NEW_OBJECT_HELPER = `
      # Creates a new object in the project with a UUID guaranteed not to collide
      # with any UUID already present in the project.
      #
      # Pod::Project uses a counter-based UUID scheme that skips collision
      # checks; in a post_install spm_dependency hook the counter can be out of
      # sync with the loaded object graph, so project.new may return an existing
      # UUID and corrupt Pods.xcodeproj on Xcode 16+/26. Backport of the
      # upstream fix (react-native commit 1cdf784, shipped in RN 0.88).
      def new_object(project, klass)
        uuid = project.generate_uuid
        uuid = project.generate_uuid while project.objects_by_uuid.key?(uuid)
        object = klass.new(project, uuid)
        object.initialize_defaults
        object
      end
`;

/**
 * Applies the spm.rb UUID-collision backport to a copy of
 * react-native/scripts/cocoapods/spm.rb. Returns the patched source, or the
 * input unchanged when the fix is already present or the file layout is not
 * recognised.
 */
export function patchSpmRb(source: string): { source: string; changed: boolean } {
  if (source.includes('def new_object(project, klass)')) {
    return { source, changed: false };
  }
  if (!source.includes('pkg = project.new(pkg_class)') || !/^\s*private\s*$/m.test(source)) {
    return { source, changed: false };
  }
  let patched = source.replace(/^(\s*private\s*)$/m, `$1\n${NEW_OBJECT_HELPER}`);
  patched = patched.replace('pkg = project.new(pkg_class)', 'pkg = new_object(project, pkg_class)');
  patched = patched.replace('ref = project.new(ref_class)', 'ref = new_object(project, ref_class)');
  return { source: patched, changed: true };
}

function findReactNativeDir(projectRoot: string): string | null {
  let dir = projectRoot;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', 'react-native');
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Backports the Pods.xcodeproj UUID-collision fix to React Native's CocoaPods
 * SPM helper. The BunnyStreamReactNative podspec uses `spm_dependency`, which
 * corrupts Pods.xcodeproj on Xcode 16+/26 with RN < 0.88 (fixed upstream by
 * commit 1cdf784). Runs as a dangerous mod so the file is patched during
 * `expo prebuild`, before `pod install` executes.
 */
export const withSpmUuidFix: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    'ios',
    async (config) => {
      const rnDir = findReactNativeDir(config.modRequest.projectRoot);
      const spmPath = rnDir && path.join(rnDir, 'scripts', 'cocoapods', 'spm.rb');
      if (!spmPath || !fs.existsSync(spmPath)) {
        WarningAggregator.addWarningIOS(
          'bunny-stream-react-native',
          'Could not locate react-native/scripts/cocoapods/spm.rb — skipping the SPM UUID-collision patch.',
        );
        return config;
      }

      const rnVersion = JSON.parse(fs.readFileSync(path.join(rnDir, 'package.json'), 'utf8'))
        .version as string;
      if (compareVersions(rnVersion, '0.88.0') >= 0) {
        return config;
      }

      const { source, changed } = patchSpmRb(fs.readFileSync(spmPath, 'utf8'));
      if (changed) {
        fs.writeFileSync(spmPath, source);
      }
      return config;
    },
  ]);
