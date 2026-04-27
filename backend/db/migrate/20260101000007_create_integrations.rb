class CreateIntegrations < ActiveRecord::Migration[7.1]
  def change
    create_table :integrations, id: :uuid do |t|
      t.references :workspace, type: :uuid, null: false, foreign_key: true
      t.string :provider, null: false
      t.string :status, null: false, default: "disconnected"
      t.jsonb :settings, default: {}, null: false
      t.text :secrets
      t.timestamps
    end
    add_index :integrations, %i[workspace_id provider], unique: true
  end
end
