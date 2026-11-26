require 'minitest/autorun'
require 'tmpdir'
require 'fileutils'
require_relative '../example/fastlane/distribution'

# Run the real lane definitions with native builds and remote uploads substituted.
class DistributionLaneHarness
  attr_reader :calls
  attr_accessor :fail_build

  def initialize
    @lanes = {}
    @calls = []
    file = File.expand_path('../example/fastlane/Fastfile', __dir__)
    instance_eval(File.read(file), file)
  end

  def lane(name, &block)
    @lanes[name] = block
  end
  alias private_lane lane

  def desc(_text); end
  def opt_out_usage; end

  def method_missing(name, *args)
    return instance_exec(*args, &@lanes[name]) if @lanes.key?(name)

    super
  end

  def respond_to_missing?(name, include_private = false)
    @lanes.key?(name) || super
  end

  def sh(*args)
    @calls << args
    return "### Fixed\n\n- Fix playback.\n" if args.include?('../scripts/release-changelog.mjs')

    manifest_path = File.join(ExampleDistribution::ROOT, 'app.json')
    if args.last == 'build:ios:ipa'
      manifest = JSON.parse(File.read(manifest_path))
      manifest['ios']['buildNumber'] = (Integer(manifest['ios']['buildNumber']) + 1).to_s
      File.write(manifest_path, JSON.generate(manifest))
      File.write(File.join(ExampleDistribution::ROOT, 'ios/Podfile.lock'), 'updated by pod install')
      File.write(File.join(ExampleDistribution::ROOT, ExampleDistribution::DEFAULT_IPA), 'new ipa fixture')
    elsif args.last == 'build:android:apk'
      manifest = JSON.parse(File.read(manifest_path))
      manifest['android']['versionCode'] = manifest['android'].fetch('versionCode', 1) + 1
      File.write(manifest_path, JSON.generate(manifest))
    end
    raise 'Native build failed' if args.include?(@fail_build)
  end

  def app_store_connect_api_key(**options)
    @calls << [:api_key, options]
    { key_id: 'test' }
  end

  def upload_to_testflight(**options)
    @calls << [:testflight, options]
  end

  def testflight_group(**options)
    @calls << [:testflight_group, options]
    'test-external-group'
  end
end

class FastlaneDistributionTest < Minitest::Test
  ENV_NAMES = %w[APP_STORE_CONNECT_API_KEY_ID APP_STORE_CONNECT_API_ISSUER_ID APP_STORE_CONNECT_API_KEY_FILE TESTFLIGHT_IPA_PATH TESTFLIGHT_AUTH TESTFLIGHT_TESTER_EMAIL FASTLANE_USER FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD APP_STORE_CONNECT_APPLE_ID APP_STORE_CONNECT_PROVIDER_PUBLIC_ID].freeze

  Group = Struct.new(:id, :name, :is_internal_group) do
    def matches_identifiers?(identifiers)
      identifiers.include?(id) || identifiers.include?(name)
    end
  end
  Tester = Struct.new(:beta_groups)

  def setup
    @directory = Dir.mktmpdir('bunny-fastlane-')
    @original_root = ExampleDistribution::ROOT
    ExampleDistribution.send(:remove_const, :ROOT)
    ExampleDistribution.const_set(:ROOT, @directory)
    @original_env = ENV_NAMES.to_h { |key| [key, ENV[key]] }
    ENV_NAMES.each { |key| ENV.delete(key) }
    @key_file = File.join(@directory, 'test.p8')
    File.write(@key_file, 'test fixture, not a private key')
    ENV['APP_STORE_CONNECT_API_KEY_ID'] = 'test-key'
    ENV['APP_STORE_CONNECT_API_ISSUER_ID'] = 'test-issuer'
    ENV['APP_STORE_CONNECT_API_KEY_FILE'] = @key_file
    FileUtils.mkdir_p(File.join(@directory, 'ios/build/ipa'))
    @ipa = File.join(@directory, 'ios/build/ipa/ReactTestApp.ipa')
    File.write(@ipa, 'ipa fixture')
    @manifest = File.join(@directory, 'app.json')
    @original_manifest = '{"ios":{"bundleIdentifier":"net.bunny.demo","buildNumber":"1"},"android":{}}'
    File.write(@manifest, @original_manifest)
    File.write(File.join(@directory, 'package.json'), '{"version":"1.2.3"}')
    @podfile_lock = File.join(@directory, 'ios/Podfile.lock')
    File.write(@podfile_lock, 'original lockfile')
    @runner = DistributionLaneHarness.new
  end

  def teardown
    @original_env.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
    ExampleDistribution.send(:remove_const, :ROOT)
    ExampleDistribution.const_set(:ROOT, @original_root)
    FileUtils.remove_entry(@directory)
  end

  def test_both_builds_complete_before_any_upload
    @runner.distribute
    calls = @runner.calls
    ios = calls.index(['npm', 'run', 'build:ios:ipa'])
    android = calls.index(['npm', 'run', 'build:android:apk'])
    upload = calls.index { |call| call.first == :testflight }
    firebase_upload = calls.index(['node', '../scripts/distribute-android.mjs'])
    assert_operator ios, :<, android
    assert_operator android, :<, firebase_upload
    assert_operator firebase_upload, :<, upload
    options = calls[upload].last
    assert_equal @ipa, options[:ipa]
    assert_equal 'net.bunny.demo', options[:app_identifier]
    assert options[:skip_waiting_for_build_processing]
    assert options[:skip_submission]
    refute options[:distribute_external]
    assert_equal "### Fixed\n\n- Fix playback.", options[:changelog]
  end

  def test_external_distribution_targets_the_testers_group_with_changelog_and_notifications
    ENV['TESTFLIGHT_TESTER_EMAIL'] = 'tester@example.com'
    @runner.distribute_ios
    lookup = @runner.calls.find { |call| call.first == :testflight_group }.last
    assert_equal 'tester@example.com', lookup[:tester_email]
    assert_equal 'net.bunny.demo', lookup[:app_identifier]
    options = @runner.calls.find { |call| call.first == :testflight }.last
    assert_equal ['test-external-group'], options[:groups]
    assert options[:distribute_external]
    assert options[:notify_external_testers]
    assert options[:submit_beta_review]
    refute options[:skip_waiting_for_build_processing]
    refute options[:skip_submission]
    assert_equal "### Fixed\n\n- Fix playback.", options[:changelog]
  end

  def test_external_group_matches_only_the_testers_membership_in_this_app
    internal = Group.new('1', 'Internal', true)
    target = Group.new('2', 'External', false)
    other = Group.new('3', 'Other', false)
    separate_app = Group.new('4', 'Separate app', false)
    tester = Tester.new([internal, target, separate_app])
    assert_equal '2', ExampleDistribution.external_group([internal, target, other], tester, '')
    assert_raises(ArgumentError) { ExampleDistribution.external_group([internal, other], tester, '') }
    tester.beta_groups << other
    assert_raises(ArgumentError) { ExampleDistribution.external_group([target, other], tester, '') }
    assert_equal '3', ExampleDistribution.external_group([target, other], tester, 'Other')
  end

  def test_failed_build_never_uploads_previous_artifacts
    @runner.fail_build = 'build:android:apk'
    assert_raises(RuntimeError) { @runner.distribute }
    refute @runner.calls.any? { |call| call.first == :testflight }
    refute_includes @runner.calls, ['node', '../scripts/distribute-android.mjs']
    assert_equal @original_manifest, File.read(@manifest)
    assert_equal 'original lockfile', File.read(@podfile_lock)
    assert_equal({ 'buildNumber' => '2', 'versionCode' => 2 }, build_numbers)
  end

  def test_local_build_numbers_advance_without_changing_tracked_files
    @runner.distribute
    @runner.distribute

    assert_equal({ 'buildNumber' => '3', 'versionCode' => 3 }, build_numbers)
    assert_equal @original_manifest, File.read(@manifest)
    assert_equal 'original lockfile', File.read(@podfile_lock)
  end

  def test_build_and_upload_ignores_retry_ipa_override
    ENV['TESTFLIGHT_IPA_PATH'] = 'previous.ipa'
    File.write(File.join(@directory, 'previous.ipa'), 'old ipa fixture')
    @runner.distribute_ios

    options = @runner.calls.find { |call| call.first == :testflight }.last
    assert_equal @ipa, options[:ipa]
    assert_equal 'new ipa fixture', File.read(@ipa)
  end

  def test_missing_apple_configuration_fails_before_any_build
    ENV.delete('APP_STORE_CONNECT_API_KEY_ID')
    error = assert_raises(ArgumentError) { @runner.distribute }
    assert_includes error.message, 'APP_STORE_CONNECT_API_KEY_ID'
    assert_empty @runner.calls
  end

  def test_upload_retry_does_not_build_or_bump_numbers
    @runner.upload_ios
    assert_equal [:api_key, 'node', :testflight], @runner.calls.map(&:first)
    @runner.upload_android
    assert_equal ['node', '../scripts/distribute-android.mjs'], @runner.calls.last
  end

  def test_missing_or_ambiguous_ipa_does_not_upload_a_different_file
    File.unlink(@ipa)
    File.write(File.join(@directory, 'ios/build/ipa/old-copy.ipa'), 'old build')
    assert_raises(ArgumentError) { @runner.upload_ios }
    assert_empty @runner.calls
  end

  def test_explicit_ipa_path_and_key_file_validation
    File.write(File.join(@directory, 'custom.ipa'), 'custom build')
    assert_equal File.join(@directory, 'custom.ipa'), ExampleDistribution.ipa_path('TESTFLIGHT_IPA_PATH' => 'custom.ipa')
    assert_equal @key_file, ExampleDistribution.api_key_options[:key_filepath]
    File.unlink(@key_file)
    assert_raises(ArgumentError) { ExampleDistribution.api_key_options }
  end

  def test_apple_id_upload_uses_app_specific_password_without_api_key_or_web_login
    ENV['TESTFLIGHT_AUTH'] = 'apple_id'
    ENV['FASTLANE_USER'] = 'developer@example.com'
    ENV['FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD'] = 'test-app-specific-password'
    ENV['APP_STORE_CONNECT_APPLE_ID'] = '1234567890'
    ENV['APP_STORE_CONNECT_PROVIDER_PUBLIC_ID'] = 'test-provider'
    @runner.distribute_ios
    refute @runner.calls.any? { |call| call.first == :api_key }
    options = @runner.calls.find { |call| call.first == :testflight }.last
    assert_equal 'developer@example.com', options[:username]
    assert_equal '1234567890', options[:apple_id]
    assert_equal 'test-provider', options[:provider_public_id]
    assert options[:skip_waiting_for_build_processing]
    refute options.key?(:changelog)
    refute_includes @runner.calls.inspect, ENV['FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD']
  end

  def test_apple_id_credentials_are_checked_before_building
    ENV['TESTFLIGHT_AUTH'] = 'apple_id'
    error = assert_raises(ArgumentError) { @runner.distribute_ios }
    assert_includes error.message, 'FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD'
    assert_empty @runner.calls
  end

  def test_apple_id_mode_is_selected_when_no_api_key_is_configured
    env = {
      'FASTLANE_USER' => 'developer@example.com',
      'FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD' => 'test-password',
      'APP_STORE_CONNECT_APPLE_ID' => '1234567890'
    }
    assert_equal({ username: 'developer@example.com', apple_id: '1234567890' }, ExampleDistribution.ios_auth_options(env))
    env['APP_STORE_CONNECT_APPLE_ID'] = 'net.bunny.demo'
    assert_raises(ArgumentError) { ExampleDistribution.ios_auth_options(env) }
    env['TESTFLIGHT_AUTH'] = 'invalid'
    assert_raises(ArgumentError) { ExampleDistribution.ios_auth_options(env) }
  end

  private

  def build_numbers
    JSON.parse(File.read(File.join(@directory, '.distribution/build-numbers.json')))
  end
end
