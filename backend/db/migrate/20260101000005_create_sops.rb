class CreateSops < ActiveRecord::Migration[7.1]
  def change
    create_table :sops, id: :uuid do |t|
      t.references :workspace, type: :uuid, null: false, foreign_key: true
      t.references :owner, type: :uuid, foreign_key: { to_table: :users }
      t.references :workflow, type: :uuid, foreign_key: true
      t.string :title, null: false
      t.text :description
      t.string :status, null: false, default: "draft"
      t.jsonb :tags, default: [], null: false
      t.jsonb :steps, default: [], null: false
      t.float :confidence, default: 0.0
      t.integer :runs_observed, default: 0
      t.integer :contributors, default: 0
      t.integer :average_duration_sec, default: 0
      t.timestamps
    end
    add_index :sops, :status
    add_index :sops, :tags, using: :gin
  end
end
