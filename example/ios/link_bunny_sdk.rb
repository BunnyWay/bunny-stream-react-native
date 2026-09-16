#!/usr/bin/env ruby

require "fileutils"
require "xcodeproj"

example_dir = File.expand_path(File.join(__dir__, ".."))
assets_catalog_path = File.join(example_dir, "node_modules", "react-native-test-app", "ios", "assetsCatalog.mjs")
if File.exist?(assets_catalog_path)
  source = File.read(assets_catalog_path)
  patched = source.sub('spawnSync("sips", args, { stdio: "inherit" });', 'spawnSync("sips", args, { stdio: "ignore" });')
  File.write(assets_catalog_path, patched) if source != patched
end

# Patch React Native's CocoaPods SPM helper to prevent a UUID collision that
# corrupts Pods.xcodeproj on Xcode 16+/26 when a podspec uses `spm_dependency`.
#
# `spm_dependency` injects `XCRemoteSwiftPackageReference` /
# `XCSwiftPackageProductDependency` objects via `project.new(...)`, which uses
# `Pod::Project`'s deterministic counter-based UUID scheme. That scheme skips
# collision checks, so when the counter is out of sync with the loaded object
# graph (e.g. after an incremental `pod install`), the first generated UUID
# collides with the root `PBXProject` UUID (`<prefix>00000000`), overwriting it.
# Xcode then refuses to load Pods.xcodeproj:
#   -[XCSwiftPackageProductDependency _setSavedArchiveVersion:]: unrecognized selector
#
# The upstream fix (react-native commit 1cdf784, shipped in 0.88) routes object
# creation through a `new_object` helper that probes `generate_uuid` forward
# past any UUID already present in `objects_by_uuid`. We backport that helper
# here so RN 0.86.2 works on Xcode 26. Remove this patch after upgrading to a
# React Native version that includes commit 1cdf784.
# TODO(iOS SDK): Remove this spm.rb patch after upgrading to React Native >= 0.88.
spm_path = File.join(example_dir, "node_modules", "react-native", "scripts", "cocoapods", "spm.rb")
if File.exist?(spm_path)
  spm_src = File.read(spm_path)
  if spm_src.include?("def new_object(project, klass)")
    puts "[BunnyStream] spm.rb UUID collision fix already applied, skipping"
  else
    # Insert the new_object helper right after the `private` keyword.
    new_object_helper = <<~'RUBY'

      # Creates a new object in the project with a UUID guaranteed not to collide
      # with any UUID already present in the project.
      #
      # `Pod::Project` overrides `generate_available_uuid_list` with a fast,
      # counter-based scheme (`<sha prefix><counter>0`) that deliberately skips
      # collision checks, on the assumption that the whole Pods project is generated
      # in a single pass. That assumption does not hold here: we run in a
      # `post_install` hook, and the generator's counter can be out of sync with the
      # UUIDs already assigned to existing objects (e.g. when the project has been
      # reloaded from disk during an incremental install, the counter restarts at 0
      # while the root object still occupies `<prefix>00000000`). Using `project.new`
      # directly can therefore hand back a UUID that is already in use and overwrite
      # an existing object (notably the root `PBXProject`), producing a Pods project
      # Xcode refuses to load. We keep the deterministic scheme but probe forward
      # until we find a UUID that is actually free.
      def new_object(project, klass)
        uuid = project.generate_uuid
        uuid = project.generate_uuid while project.objects_by_uuid.key?(uuid)
        object = klass.new(project, uuid)
        object.initialize_defaults
        object
      end
    RUBY
    spm_src = spm_src.sub(/^(\s*private\s*)$/m, "\\1\n#{new_object_helper}")
    # Route all `project.new(...)` calls in add_spm_to_target through new_object.
    spm_src = spm_src.gsub('pkg = project.new(pkg_class)', 'pkg = new_object(project, pkg_class)')
    spm_src = spm_src.gsub('ref = project.new(ref_class)', 'ref = new_object(project, ref_class)')
    File.write(spm_path, spm_src)
    puts "[BunnyStream] Patched spm.rb to prevent Pods.xcodeproj UUID collision (Xcode 16+/26 fix)"
  end
end

exit if ARGV.include?("--prepare")

project_path = File.join(example_dir, "node_modules", ".generated", "ios", "ReactTestApp.xcodeproj")
project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |candidate| candidate.name == "ReactTestApp" }
abort "ReactTestApp target not found" unless target

generated_icon_set = File.join(example_dir, "node_modules", ".generated", "ios", "AppIcon.appiconset")
assets_icon_set = File.join(example_dir, "node_modules", ".generated", "ios", "Assets.xcassets", "AppIcon.appiconset")
if Dir.exist?(generated_icon_set)
  FileUtils.mkdir_p(assets_icon_set)
  FileUtils.cp_r(Dir.glob(File.join(generated_icon_set, "*")), assets_icon_set)
  puts "[BunnyStream] Installed generated iOS app icons in Assets.xcassets"
end

phase_name = "[BunnyStream] Embed SwiftPM Frameworks"
phase = target.shell_script_build_phases.find { |candidate| candidate.name == phase_name }
phase ||= target.new_shell_script_build_phase(phase_name)
phase.shell_path = "/bin/sh"
phase.input_paths = [
  "${BUILT_PRODUCTS_DIR}/BunnyStreamReactNative/GoogleInteractiveMediaAds.framework",
]
phase.output_paths = [
  "${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}/GoogleInteractiveMediaAds.framework",
]
phase.shell_script = <<~'SH'
  set -euo pipefail

  SOURCE_FRAMEWORK="${BUILT_PRODUCTS_DIR}/BunnyStreamReactNative/GoogleInteractiveMediaAds.framework"
  if [ ! -d "${SOURCE_FRAMEWORK}" ]; then
    SOURCE_FRAMEWORK="${BUILT_PRODUCTS_DIR}/GoogleInteractiveMediaAds.framework"
  fi

  if [ ! -d "${SOURCE_FRAMEWORK}" ]; then
    echo "error: GoogleInteractiveMediaAds.framework was not produced by SwiftPM"
    exit 1
  fi

  DESTINATION="${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}"
  mkdir -p "${DESTINATION}"
  rm -rf "${DESTINATION}/GoogleInteractiveMediaAds.framework"
  ditto "${SOURCE_FRAMEWORK}" "${DESTINATION}/GoogleInteractiveMediaAds.framework"

  if [ -n "${EXPANDED_CODE_SIGN_IDENTITY:-}" ] && [ "${CODE_SIGNING_ALLOWED:-NO}" = "YES" ]; then
    /usr/bin/codesign --force --sign "${EXPANDED_CODE_SIGN_IDENTITY}" --preserve-metadata=identifier,entitlements "${DESTINATION}/GoogleInteractiveMediaAds.framework"
  fi

  # Workaround for long-standing Xcode 15+ SwiftPM binaryTarget archive bug:
  # SPM emits "<fw>.xcframework-ios.signature" into CONFIGURATION_BUILD_DIR
  # more than once, and Xcode's archive packaging then fails with
  # "... couldn't be copied to Signatures because an item with the same name
  # already exists". Deleting the duplicate before archive packaging fixes it.
  # Idempotent and a no-op on non-archive builds.
  rm -rf "${CONFIGURATION_BUILD_DIR}/GoogleInteractiveMediaAds.xcframework-ios.signature"
SH

# Patch react-native-host so third-party TurboModules registered in
# RCTModuleProviders are found by the RCTTurboModuleManager. This is needed
# because react-native-host 0.5.21 only looks up core modules via
# RCTCoreModulesClassProvider and does not consult the generated
# RCTModuleProviders mapping for Codegen third-party modules.
tna_path = File.join(example_dir, "node_modules", "@rnx-kit", "react-native-host", "cocoa", "RNXTurboModuleAdapter.mm")
if File.exist?(tna_path)
  tna_src = File.read(tna_path)
  tna_old = <<~'OBJC'
    - (Class)getModuleClassFromName:(char const *)name
    {
        return RCTCoreModulesClassProvider(name);
    }
  OBJC
  tna_new = <<~'OBJC'
    - (Class)getModuleClassFromName:(char const *)name
    {
        Class coreModule = RCTCoreModulesClassProvider(name);
        if (coreModule != nil) {
            return coreModule;
        }

        // Local workaround for private iOS SDK integration: React Native 0.86's
        // react-native-host does not look up third-party Codegen modules in
        // RCTModuleProviders. We fall back to the generated providers for any
        // module that isn't a core module.
        Class providersClass = NSClassFromString(@"RCTModuleProviders");
        if (providersClass == nil) {
            return nil;
        }

        NSDictionary<NSString *, id> *providers = [providersClass performSelector:@selector(moduleProviders)];
        NSString *moduleName = [NSString stringWithUTF8String:name];
        id provider = providers[moduleName];
        if (provider == nil) {
            return nil;
        }

        return [provider class];
    }
  OBJC

  if tna_src.include?(tna_old.strip)
    File.write(tna_path, tna_src.sub(tna_old.strip, tna_new.strip))
    puts "[BunnyStream] Patched RNXTurboModuleAdapter.mm to resolve third-party TurboModules"
  else
    puts "[BunnyStream] RNXTurboModuleAdapter.mm already patched or unrecognised, skipping"
  end
else
  puts "[BunnyStream] RNXTurboModuleAdapter.mm not found, cannot patch"
end

# Configure signing for App Store distribution on the ReactTestApp target
# only (not SPM packages, which don't support provisioning profiles).
# Debug gets just the team so automatic development signing works on
# physical devices (xcodebuild fails with "requires a development team"
# without it).
debug_config = target.build_configurations.find { |c| c.name == "Debug" }
if debug_config
  debug_config.build_settings["DEVELOPMENT_TEAM"] = "GX6PPA6X9F"
  puts "[BunnyStream] Configured Debug signing: automatic + team GX6PPA6X9F"
else
  warn "[BunnyStream] Debug configuration not found on ReactTestApp target — skipping team config"
end

release_config = target.build_configurations.find { |c| c.name == "Release" }
if release_config
  release_config.build_settings["CODE_SIGN_STYLE"] = "Manual"
  release_config.build_settings["CODE_SIGN_IDENTITY"] = "Apple Distribution"
  release_config.build_settings["PROVISIONING_PROFILE_SPECIFIER"] = "Bunny StreamSDK ReactNative Demo"
  release_config.build_settings["DEVELOPMENT_TEAM"] = "GX6PPA6X9F"
  puts "[BunnyStream] Configured Release signing: Apple Distribution + Bunny StreamSDK ReactNative Demo"
else
  warn "[BunnyStream] Release configuration not found on ReactTestApp target — skipping signing config"
end

# Patch the generated Info.plist to add camera and microphone usage
# descriptions required for the broadcaster (BunnyStreamCameraUpload).
# RNTA's template only declares NSCameraUsageDescription for QR bundle URL
# scanning; we replace it with a broadcast-specific message and add
# NSMicrophoneUsageDescription.
generated_info_plist = File.join(example_dir, "node_modules", ".generated", "ios", "Info.plist")
if File.exist?(generated_info_plist)
  plist_doc = Xcodeproj::Plist.read_from_path(generated_info_plist)
  plist_doc["NSCameraUsageDescription"] =
    "This app uses the camera to record and broadcast video to Bunny Stream."
  plist_doc["NSMicrophoneUsageDescription"] =
    "This app uses the microphone to capture audio during recording and broadcasting."
  # The "Audio, AirPlay, and Picture in Picture" background mode maps to the
  # `audio` UIBackgroundModes value — required for AVPictureInPictureController
  # to start (see PictureInPictureManager in the iOS SDK).
  modes = plist_doc["UIBackgroundModes"] ||= []
  modes << "audio" unless modes.include?("audio")
  Xcodeproj::Plist.write_to_path(plist_doc, generated_info_plist)
  puts "[BunnyStream] Patched Info.plist with usage descriptions + audio background mode"
else
  warn "[BunnyStream] Generated Info.plist not found, skipping usage description patch"
end

project.save
puts "[BunnyStream] Configured SwiftPM framework embedding in #{project_path}"
