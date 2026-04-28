# frozen_string_literal: true

ENV['BUNDLE_GEMFILE'] ||= File.expand_path('../Gemfile', __dir__)

require 'bundler/setup'

# Monorepo: load secrets from repo-root `.env` (same file Docker Compose uses).
if %w[development test].include?(ENV.fetch('RAILS_ENV', 'development'))
  begin
    require 'dotenv'
    root_env = File.expand_path('../../.env', __dir__)
    # Load without overwriting keys already set (e.g. RAILS_ENV=test under RSpec).
    Dotenv.load(root_env) if File.exist?(root_env)
  rescue LoadError
    # dotenv group-scoped out (e.g. production bundle --without)
  end
end

require 'bootsnap/setup'
