class CreateWorkspaces < ActiveRecord::Migration[7.1]
  def change
    enable_extension "pgcrypto" unless extension_enabled?("pgcrypto")

    create_table :workspaces, id: :uuid do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.jsonb :settings, default: {}, null: false
      t.timestamps
    end
    add_index :workspaces, :slug, unique: true
  end
end
