class AddOrganizationFieldsToWorkspaces < ActiveRecord::Migration[7.1]
  def change
    add_column :workspaces, :claimed_domain, :string
    add_column :workspaces, :domain_verified_at, :datetime
    add_column :workspaces, :dns_verification_token, :string
    add_column :workspaces, :billing_plan, :string, null: false, default: "free_trial"
    add_column :workspaces, :trial_ends_at, :datetime
    add_column :workspaces, :seats_limit, :integer, null: false, default: 50

    reversible do |dir|
      dir.up do
        execute <<-SQL.squish
          UPDATE workspaces
          SET domain_verified_at = NOW(),
              billing_plan = 'professional',
              seats_limit = 50
          WHERE domain_verified_at IS NULL
        SQL
      end
    end

    add_index :workspaces, :claimed_domain
    add_index :workspaces, :dns_verification_token, unique: true
  end
end
