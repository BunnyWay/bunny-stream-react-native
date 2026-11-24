module ExampleDistribution
  ROOT = File.expand_path('..', __dir__)

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
    path = File.expand_path(env.fetch('TESTFLIGHT_IPA_PATH', 'ios/build/ipa/ReactTestApp.ipa'), ROOT)
    raise ArgumentError, "IPA not found: #{path}. Run yarn example:distribute:ios to build and upload." unless File.file?(path)

    path
  end
end
