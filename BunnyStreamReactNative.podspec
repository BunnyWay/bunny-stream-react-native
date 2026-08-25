require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "BunnyStreamReactNative"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/BunnyWay/bunny-stream-react-native.git", :tag => "#{s.version}" }

  # During development, all native bridge files (Swift + ObjC++) are added
  # directly to the app target via the link_bunny_sdk.rb script so they can
  # import the SDK's SwiftPM modules. The pod is kept as a no-op shell so
  # autolinking still registers the TurboModule and component views.
  # For distribution, the source_files should include all ios/**/*.{h,m,mm,swift,cpp}
  # and the SDK should be a proper dependency (Plan-iOS.md §12.3).
  s.source_files = "ios/**/*.podstub"
  s.private_header_files = ""

  # Swift support requires the bridging header import to find the generated
  # Codegen spec umbrella header.
  s.dependency "React-Core"
  s.dependency "React-RCTFabric"
  s.dependency "React-Codegen"

  # The Bunny Stream iOS SDK is linked as a local SwiftPM package in the
  # example app via a post_install hook in the Podfile. For distribution a
  # vendored XCFramework or published pod should replace this (Plan-iOS.md §12.3).
  # s.dependency "BunnyStream"

  install_modules_dependencies(s)
end
