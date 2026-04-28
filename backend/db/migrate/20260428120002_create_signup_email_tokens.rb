class CreateSignupEmailTokens < ActiveRecord::Migration[7.1]
  def change
    create_table :signup_email_tokens, id: :uuid do |t|
      t.references :workspace, type: :uuid, null: false, foreign_key: true
      t.string :token, null: false
      t.datetime :expires_at, null: false
      t.datetime :consumed_at
      t.timestamps
    end

    add_index :signup_email_tokens, :token, unique: true
    add_index :signup_email_tokens, [:workspace_id, :consumed_at]
  end
end
