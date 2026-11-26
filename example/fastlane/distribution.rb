require 'fileutils'
require 'json'

module ExampleDistribution
  ROOT = File.expand_path('..', __dir__)
  DEFAULT_IPA = 'ios/build/ipa/ReactTestApp.ipa'.freeze
  BUILD_NUMBER_FIELDS = { 'ios' => 'buildNumber', 'android' => 'versionCode' }.freeze

  def self.with_lock
    state_dir = File.join(ROOT, '.distribution')
    FileUtils.mkdir_p(state_dir)
    File.open(File.join(state_dir, 'lock'), 'w') do |lock|
      raise 'Another example distribution is running in this checkout.' unless lock.flock(File::LOCK_EX | File::LOCK_NB)

      yield state_dir
    end
  end

  def self.with_build_numbers
    with_lock do |state_dir|
      manifest_path = File.join(ROOT, 'app.json')
      podfile_lock_path = File.join(ROOT, 'ios/Podfile.lock')
      state_path = File.join(state_dir, 'build-numbers.json')
      original_manifest = File.binread(manifest_path)
      original_podfile_lock = File.binread(podfile_lock_path) if File.file?(podfile_lock_path)
      manifest = JSON.parse(original_manifest)
      numbers = File.file?(state_path) ? JSON.parse(File.read(state_path)) : {}
      BUILD_NUMBER_FIELDS.each do |platform, field|
        current = manifest.fetch(platform)[field]
        last = numbers[field]
        manifest[platform][field] = last if last && Integer(last) > Integer(current || 1)
      end

      begin
        # React Native Test App reads build numbers from the manifest. Keep the
        # next build's starting numbers locally so release-it sees a clean tree.
        File.write(manifest_path, JSON.pretty_generate(manifest) + "\n")
        yield
      ensure
        begin
          manifest = JSON.parse(File.read(manifest_path))
          BUILD_NUMBER_FIELDS.each do |platform, field|
            number = manifest.fetch(platform)[field]
            numbers[field] = number unless number.nil?
          end
          File.write("#{state_path}.tmp", JSON.pretty_generate(numbers) + "\n")
          File.rename("#{state_path}.tmp", state_path)
        ensure
          File.binwrite(manifest_path, original_manifest)
          File.binwrite(podfile_lock_path, original_podfile_lock) if original_podfile_lock
        end
      end
    end
  end

  def self.ios_auth_options(env = ENV)
    api_names = %w[APP_STORE_CONNECT_API_KEY_ID APP_STORE_CONNECT_API_ISSUER_ID APP_STORE_CONNECT_API_KEY_FILE]
    default_mode = api_names.any? { |name| !env[name].to_s.strip.empty? } ? 'api_key' : 'apple_id'
    mode = env.fetch('TESTFLIGHT_AUTH', default_mode)
    return { api_key_options: api_key_options(env) } if mode == 'api_key'
    unless mode == 'apple_id'
      raise ArgumentError, 'TESTFLIGHT_AUTH must be apple_id or api_key.'
    end

    names = %w[FASTLANE_USER FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD APP_STORE_CONNECT_APPLE_ID]
    missing = names.select { |name| env[name].to_s.strip.empty? }
    unless missing.empty?
      raise ArgumentError, "Set #{missing.join(', ')} in example/fastlane/.env for Apple ID uploads."
    end
    unless env.fetch('APP_STORE_CONNECT_APPLE_ID').match?(/\A[0-9]+\z/)
      raise ArgumentError, 'APP_STORE_CONNECT_APPLE_ID must be the numeric Apple ID from App Store Connect > App Information, not the bundle ID.'
    end

    options = {
      username: env.fetch('FASTLANE_USER'),
      apple_id: env.fetch('APP_STORE_CONNECT_APPLE_ID')
    }
    provider = env['APP_STORE_CONNECT_PROVIDER_PUBLIC_ID'].to_s.strip
    options[:provider_public_id] = provider unless provider.empty?
    # The transporter reads the app-specific password directly from ENV.
    # Never include it in action parameters or logs.
    options
  end

  def self.api_key_options(env = ENV)
    names = %w[APP_STORE_CONNECT_API_KEY_ID APP_STORE_CONNECT_API_ISSUER_ID APP_STORE_CONNECT_API_KEY_FILE]
    missing = names.select { |name| env[name].to_s.strip.empty? }
    unless missing.empty?
      raise ArgumentError, "Set #{missing.join(', ')} in example/fastlane/.env (see .env.example)."
    end

    key_file = File.expand_path(env.fetch('APP_STORE_CONNECT_API_KEY_FILE'), ROOT)
    raise ArgumentError, "App Store Connect API key file not found: #{key_file}" unless File.file?(key_file)

    {
      key_id: env.fetch('APP_STORE_CONNECT_API_KEY_ID'),
      issuer_id: env.fetch('APP_STORE_CONNECT_API_ISSUER_ID'),
      key_filepath: key_file,
      in_house: false
    }
  end

  def self.ipa_path(env = ENV)
    path = File.expand_path(env.fetch('TESTFLIGHT_IPA_PATH', DEFAULT_IPA), ROOT)
    raise ArgumentError, "IPA not found: #{path}. Run yarn example:distribute:ios to build and upload." unless File.file?(path)

    path
  end

  def self.external_group(groups, tester, preferred_group)
    tester_group_ids = Array(tester&.beta_groups).map(&:id)
    matches = groups.select do |group|
      group.is_internal_group == false && tester_group_ids.include?(group.id) &&
        (preferred_group.empty? || group.matches_identifiers?([preferred_group]))
    end
    if matches.empty?
      raise ArgumentError, 'The configured TestFlight tester is not in a matching external group for this app.'
    end
    if matches.length > 1
      raise ArgumentError, 'The tester belongs to multiple external groups. Set TESTFLIGHT_GROUP to the intended group name or ID.'
    end

    matches.first.id
  end
end
