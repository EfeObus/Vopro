require "sidekiq/testing"
require "rspec-sidekiq"

Sidekiq::Testing.fake!

RSpec.configure do |config|
  config.before(:each) do
    Sidekiq::Worker.clear_all
  end
end
