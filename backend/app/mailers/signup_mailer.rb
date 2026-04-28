class SignupMailer < ApplicationMailer
  def verify_email(to:, workspace_name:, verify_url:)
    @workspace_name = workspace_name
    @verify_url = verify_url

    mail(to: to, subject: "Verify your organization domain for Vopro")
  end
end
