require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
ios_sdk_path = ENV.fetch(
  "BUNNY_STREAM_IOS_SDK_PATH",
  File.expand_path("../bunny-stream-ios-private", __dir__)
)

unless File.exist?(File.join(ios_sdk_path, "Package.swift"))
  raise "Bunny Stream iOS SDK not found at #{ios_sdk_path}. " \
        "Set BUNNY_STREAM_IOS_SDK_PATH to the local SDK checkout."
end

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

  # React Native's CocoaPods integration attaches these local SwiftPM products
  # directly to the BunnyStreamReactNative pod target. This keeps Swift and
  # ObjC++ bridge sources in their proper pod target while the SDK remains a
  # private local checkout.
  spm_dependency(
    s,
    url: ios_sdk_path,
    requirement: { kind: "exactVersion", version: "0.0.0" },
    products: ["BunnyStreamPlayer", "BunnyStreamAPI"]
  )
end
