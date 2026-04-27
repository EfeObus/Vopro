require "sidekiq/web"

Rails.application.routes.draw do
  mount Sidekiq::Web => "/sidekiq"

  get "/health", to: "health#show"

  namespace :api do
    namespace :v1 do
      post "events/batch", to: "events#create_batch"

      resources :workflows, only: %i[index show update] do
        member do
          post :generate_sop
          post :dismiss
        end
      end

      resources :sops do
        member do
          get :versions
          post :publish
          post :archive
          get :export
        end
      end

      resources :integrations, only: %i[index create destroy update] do
        collection do
          get  ":provider/start",    to: "integrations/oauth#start",    as: :oauth_start
          get  ":provider/callback", to: "integrations/oauth#callback", as: :oauth_callback
        end
      end

      get "analytics/overview", to: "analytics#overview"
      get "analytics/bottlenecks", to: "analytics#bottlenecks"

      post "auth/login", to: "auth#login"
      post "auth/refresh", to: "auth#refresh"
      get  "auth/me", to: "auth#me"
    end
  end
end
