import type { ResolvedBunnyStreamPluginProps } from './types';

export const EMBED_PHASE_NAME = '[BunnyStream] Embed SwiftPM Frameworks';

/**
 * Copies GoogleInteractiveMediaAds.framework (a SwiftPM binaryTarget pulled in
 * transitively by the Bunny Stream iOS SDK) into the app bundle. CocoaPods does
 * not embed SwiftPM binary targets produced while building the
 * BunnyStreamReactNative pod, so without this phase the framework is missing
 * at runtime. Mirrors the build phase the bare example app installs via
 * `example/ios/link_bunny_sdk.rb`.
 */
const EMBED_FRAMEWORKS_SCRIPT = `set -euo pipefail

SOURCE_FRAMEWORK="\${BUILT_PRODUCTS_DIR}/BunnyStreamReactNative/GoogleInteractiveMediaAds.framework"
if [ ! -d "\${SOURCE_FRAMEWORK}" ]; then
  SOURCE_FRAMEWORK="\${BUILT_PRODUCTS_DIR}/GoogleInteractiveMediaAds.framework"
fi

if [ ! -d "\${SOURCE_FRAMEWORK}" ]; then
  echo "error: GoogleInteractiveMediaAds.framework was not produced by SwiftPM"
  exit 1
fi

DESTINATION="\${TARGET_BUILD_DIR}/\${FRAMEWORKS_FOLDER_PATH}"
mkdir -p "\${DESTINATION}"
rm -rf "\${DESTINATION}/GoogleInteractiveMediaAds.framework"
ditto "\${SOURCE_FRAMEWORK}" "\${DESTINATION}/GoogleInteractiveMediaAds.framework"

if [ -n "\${EXPANDED_CODE_SIGN_IDENTITY:-}" ] && [ "\${CODE_SIGNING_ALLOWED:-NO}" = "YES" ]; then
  /usr/bin/codesign --force --sign "\${EXPANDED_CODE_SIGN_IDENTITY}" --preserve-metadata=identifier,entitlements "\${DESTINATION}/GoogleInteractiveMediaAds.framework"
fi

# Workaround for the Xcode 15+ SwiftPM binaryTarget archive bug: SPM emits
# "<fw>.xcframework-ios.signature" into CONFIGURATION_BUILD_DIR more than once
# and archive packaging fails on the duplicate. Deleting it is a no-op on
# non-archive builds.
rm -rf "\${CONFIGURATION_BUILD_DIR}/GoogleInteractiveMediaAds.xcframework-ios.signature"
`;

const EMBED_INPUT_PATHS = [
  '"${BUILT_PRODUCTS_DIR}/BunnyStreamReactNative/GoogleInteractiveMediaAds.framework"',
];
const EMBED_OUTPUT_PATHS = [
  '"${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}/GoogleInteractiveMediaAds.framework"',
];

/**
 * The `xcode` pbx writer stores string values verbatim, so a multi-line
 * shellScript must be written in the escaped single-line form Xcode itself
 * uses (`"...\n..."` with escaped quotes) rather than literal newlines.
 */
function toPbxQuoted(script: string): string {
  return `"${script.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

export function applyBunnyStreamInfoPlist(
  plist: Record<string, unknown>,
  props: ResolvedBunnyStreamPluginProps,
): Record<string, unknown> {
  if (props.cameraPermission) {
    plist['NSCameraUsageDescription'] = props.cameraPermission;
  }
  if (props.microphonePermission) {
    plist['NSMicrophoneUsageDescription'] = props.microphonePermission;
  }
  if (props.photoLibraryPermission) {
    plist['NSPhotoLibraryUsageDescription'] = props.photoLibraryPermission;
  }
  if (props.enableBackgroundAudio) {
    const modes = (plist['UIBackgroundModes'] as string[] | undefined) ?? [];
    if (!modes.includes('audio')) {
      plist['UIBackgroundModes'] = [...modes, 'audio'];
    }
  }
  return plist;
}

interface XcodeNativeTarget {
  uuid: string;
  productType?: string;
}

interface XcodeShellScriptPhase {
  name?: string;
  shellPath?: string;
  shellScript?: string;
  inputPaths?: string[];
  outputPaths?: string[];
}

interface XcodeProjectLike {
  getFirstTarget(): XcodeNativeTarget;
  addBuildPhase(
    filePathsArray: string[],
    buildPhaseType: string,
    comment: string,
    target: string,
    optionsOrFolderType?: {
      inputPaths?: string[];
      outputPaths?: string[];
      shellPath?: string;
      shellScript?: string;
    },
    subfolderPath?: string,
  ): void;
  hash: {
    project: {
      objects: {
        PBXNativeTarget?: Record<string, { productType?: string }>;
        PBXShellScriptBuildPhase?: Record<string, XcodeShellScriptPhase>;
      };
    };
  };
}

function findApplicationTargetUuid(project: XcodeProjectLike): string {
  const nativeTargets = project.hash.project.objects.PBXNativeTarget ?? {};
  for (const [uuid, target] of Object.entries(nativeTargets)) {
    if (
      uuid.endsWith('_comment') ||
      target?.productType !== '"com.apple.product-type.application"'
    ) {
      continue;
    }
    return uuid;
  }
  return project.getFirstTarget().uuid;
}

function shellScriptPhases(project: XcodeProjectLike): Record<string, XcodeShellScriptPhase> {
  return project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
}

/** Adds (or refreshes) the "Embed SwiftPM Frameworks" build phase on the app target. */
export function ensureEmbedSwiftPmFrameworksPhase(project: XcodeProjectLike): void {
  const existing = Object.values(shellScriptPhases(project)).find(
    (phase) => phase?.name === `"${EMBED_PHASE_NAME}"` || phase?.name === EMBED_PHASE_NAME,
  );
  if (existing) {
    existing.shellScript = toPbxQuoted(EMBED_FRAMEWORKS_SCRIPT);
    existing.inputPaths = EMBED_INPUT_PATHS;
    existing.outputPaths = EMBED_OUTPUT_PATHS;
    existing.shellPath = '/bin/sh';
    return;
  }

  project.addBuildPhase(
    [],
    'PBXShellScriptBuildPhase',
    EMBED_PHASE_NAME,
    findApplicationTargetUuid(project),
    {
      inputPaths: EMBED_INPUT_PATHS,
      outputPaths: EMBED_OUTPUT_PATHS,
      shellPath: '/bin/sh',
      // pbxShellScriptBuildPhaseObj only escapes quotes — escape newlines
      // ourselves so the stored value stays a single-line quoted string.
      shellScript: EMBED_FRAMEWORKS_SCRIPT.replace(/\n/g, '\\n'),
    },
  );
}
