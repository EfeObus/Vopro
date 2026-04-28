require "rails_helper"

RSpec.describe "Rate limiting", type: :request do
  before do
    # Rack::Attack uses Rails.cache; our test env uses :memory_store, but the
    # initializer rebinds it to a Redis-backed store, so for this spec we
    # force an in-process cache and clear it between examples.
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
    Rack::Attack.enabled = true
    Rack::Attack.cache.store.clear
  end

  after { Rack::Attack.enabled = false }

  it "throttles repeated /auth/login attempts from one IP with 429 + Retry-After" do
    6.times do
      post "/api/v1/auth/login",
           params: { email: "no-such@user.test", password: "x" }.to_json,
           headers: { "Content-Type" => "application/json", "REMOTE_ADDR" => "203.0.113.5" }
    end

    expect(response).to have_http_status(:too_many_requests)
    expect(response.headers["Retry-After"]).to be_present
    body = JSON.parse(response.body)
    expect(body["error"]).to be_a(Hash)
    expect(body["error"]["code"]).to eq("rate_limited")
    expect(body["error"]["message"]).to match(/too many/i)
    expect(body["error"]["status"]).to eq(429)
    expect(body["error"]["details"]["retry_after"]).to be_a(Integer)
    expect(body["retry_after"]).to be_a(Integer)
  end
end
