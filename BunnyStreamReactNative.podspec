require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
native_sdk_baselines = JSON.parse(File.read(File.join(__dir__, "native-sdk-baselines.json")))
ios_sdk_baseline = native_sdk_baselines.fetch("ios")
# Consumers resolve the public SwiftPM package from GitHub, pinned to the
# baseline commit (the public repo has no release tags yet). Setting
# BUNNY_STREAM_IOS_SDK_PATH switches to a local checkout for SDK development.
ios_sdk_path = ENV["BUNNY_STREAM_IOS_SDK_PATH"]
if ios_sdk_path
  ios_sdk_path = File.expand_path(ios_sdk_path, __dir__)
  unless File.exist?(File.join(ios_sdk_path, "Package.swift"))
    raise "Bunny Stream iOS SDK not found at #{ios_sdk_path}. " \
          "Point BUNNY_STREAM_IOS_SDK_PATH at a valid local SDK checkout."
  end
end

ios_spm_url = ios_sdk_path || "https://github.com/BunnyWay/bunny-stream-ios"
ios_spm_requirement = ios_sdk_path \
  ? { kind: "exactVersion", version: "0.0.0" } \
  : { kind: "revision", revision: ios_sdk_baseline.fetch("commit") }

Pod::Spec.new do |s|
  s.name         = "BunnyStreamReactNative"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/BunnyWay/bunny-stream-react-native.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift,cpp}"
  s.private_header_files = "ios/**/*.h"
  s.swift_version = "5.9"

  s.dependency "React-Core"
  s.dependency "React-RCTFabric"
  s.dependency "React-Codegen"

  install_modules_dependencies(s)

  # React Native's CocoaPods integration attaches the SwiftPM products directly
  # to the BunnyStreamReactNative pod target. Remote by default (public repo,
  # revision-pinned); a local path when BUNNY_STREAM_IOS_SDK_PATH is set.
  spm_dependency(
    s,
    url: ios_spm_url,
    requirement: ios_spm_requirement,
    products: ["BunnyStreamPlayer", "BunnyStreamAPI", "BunnyStreamUploader", "BunnyStreamCameraUpload"]
  )
end
