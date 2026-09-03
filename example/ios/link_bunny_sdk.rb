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

project.save
puts "[BunnyStream] Configured SwiftPM framework embedding in #{project_path}"
