module AuthHelpers
  def auth_headers_for(user)
    token = AuthenticationService.issue_token(user)
    { "Authorization" => "Bearer #{token}", "Content-Type" => "application/json" }
  end
end
