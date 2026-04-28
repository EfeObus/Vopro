FactoryBot.define do
  factory :workspace do
    sequence(:name) { |n| "Workspace #{n}" }
    sequence(:slug) { |n| "workspace-#{n}" }
    settings { {} }
  end

  factory :user do
    workspace
    sequence(:email) { |n| "user#{n}@example.com" }
    name { "Test User" }
    role { "editor" }
    password { "vopro1234" }
  end

  factory :workflow do
    workspace
    title { "Test workflow" }
    application { "Salesforce" }
    sequence(:signature) { |n| "sig-#{n}" }
    occurrences { 5 }
    confidence { 0.8 }
    last_seen_at { 1.hour.ago }
    status { "pending" }
  end

  factory :workflow_event do
    workspace
    user
    workflow
    kind { "click" }
    application { "Salesforce" }
    target { "Convert button" }
    payload { {} }
    occurred_at { Time.current }
  end

  factory :sop do
    workspace
    workflow
    association :owner, factory: :user
    title { "Test SOP" }
    description { "A test SOP" }
    status { "draft" }
    tags { %w[Test] }
    steps do
      [
        { id: "s1", order: 1, title: "Step one", description: "Do the thing", application: "Salesforce" }
      ]
    end
    confidence { 0.85 }
    runs_observed { 12 }
    contributors { 1 }
    average_duration_sec { 240 }
  end

  factory :integration do
    workspace
    provider { "google" }
    status { "disconnected" }
    settings { {} }
  end

  factory :invitation do
    workspace
    sequence(:email) { |n| "invitee#{n}@example.com" }
    role { "viewer" }
  end
end
