class OrganizationSnapshotSerializer
  def self.call(workspace, seats_used:)
    host =
      if workspace.claimed_domain.present?
        "#{DnsVerifier::SUBDOMAIN}.#{workspace.claimed_domain}"
      end

    {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      claimedDomain: workspace.claimed_domain,
      domainVerified: workspace.domain_verified_at.present?,
      domainVerifiedAt: workspace.domain_verified_at&.iso8601,
      billingPlan: workspace.billing_plan,
      trialEndsAt: workspace.trial_ends_at&.iso8601,
      trialActive: workspace.trial_active?,
      seatsLimit: workspace.seats_limit,
      seatsUsed: seats_used,
      dnsTxtHost: host,
      dnsTxtValue: workspace.dns_verification_token
    }
  end
end
