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
    raise 'Native build failed' if args.include?(@fail_build)
  end

  def app_store_connect_api_key(**options)
    @calls << [:api_key, options]
    { key_id: 'test' }
  end

  def upload_to_testflight(**options)
    @calls << [:testflight, options]
  end
end

class FastlaneDistributionTest < Minitest::Test
  ENV_NAMES = %w[APP_STORE_CONNECT_API_KEY_ID APP_STORE_CONNECT_API_ISSUER_ID APP_STORE_CONNECT_API_KEY_FILE TESTFLIGHT_IPA_PATH TESTFLIGHT_AUTH FASTLANE_USER FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD APP_STORE_CONNECT_APPLE_ID APP_STORE_CONNECT_PROVIDER_PUBLIC_ID].freeze

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
    File.write(File.join(@directory, 'app.json'), '{"ios":{"bundleIdentifier":"net.bunny.demo"}}')
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
    assert_operator ios, :<, android
    assert_operator android, :<, upload
    assert_equal ['node', '../scripts/distribute-android.mjs'], calls.last
    options = calls[upload].last
    assert_equal @ipa, options[:ipa]
    assert_equal 'net.bunny.demo', options[:app_identifier]
    assert options[:skip_waiting_for_build_processing]
    assert options[:skip_submission]
    refute options[:distribute_external]
  end

  def test_failed_build_never_uploads_previous_artifacts
    @runner.fail_build = 'build:android:apk'
    assert_raises(RuntimeError) { @runner.distribute }
    refute @runner.calls.any? { |call| call.first == :testflight }
    refute_includes @runner.calls, ['node', '../scripts/distribute-android.mjs']
  end

  def test_missing_apple_configuration_fails_before_any_build
    ENV.delete('APP_STORE_CONNECT_API_KEY_ID')
    error = assert_raises(ArgumentError) { @runner.distribute }
    assert_includes error.message, 'APP_STORE_CONNECT_API_KEY_ID'
    assert_empty @runner.calls
  end

  def test_upload_retry_does_not_build_or_bump_numbers
    @runner.upload_ios
    assert_equal [:api_key, :testflight], @runner.calls.map(&:first)
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
end
