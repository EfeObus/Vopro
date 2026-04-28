class CreateUserConsents < ActiveRecord::Migration[7.1]
  def change
    create_table :user_consents, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.string :consent_key, null: false
      t.datetime :accepted_at, null: false
      t.string :ip
      t.jsonb :metadata, default: {}, null: false
      t.timestamps
    end

    add_index :user_consents, [:user_id, :consent_key], unique: true
  end
end
