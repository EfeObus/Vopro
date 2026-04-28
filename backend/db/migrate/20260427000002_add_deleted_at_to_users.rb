class AddDeletedAtToUsers < ActiveRecord::Migration[7.1]
  # Soft-delete column so GDPR right-to-erasure can anonymise the user
  # without breaking foreign keys on sops/audit_logs.
  def change
    add_column :users, :deleted_at, :datetime
    add_index  :users, :deleted_at
  end
end
