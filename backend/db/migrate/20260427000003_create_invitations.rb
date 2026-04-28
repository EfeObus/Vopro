class CreateInvitations < ActiveRecord::Migration[7.1]
  def change
    create_table :invitations, id: :uuid, default: -> { "gen_random_uuid()" } do |t|
      t.references :workspace, type: :uuid, null: false, foreign_key: true
      t.references :inviter,   type: :uuid, null: true,
                                foreign_key: { to_table: :users }
      t.string :email,      null: false
      t.string :role,       null: false, default: "viewer"
      t.string :token,      null: false
      t.datetime :expires_at, null: false
      t.datetime :accepted_at
      t.datetime :revoked_at
      t.timestamps
    end

    add_index :invitations, :token, unique: true
    add_index :invitations, [:workspace_id, :email]
  end
end
