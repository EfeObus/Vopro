class CreateWorkflows < ActiveRecord::Migration[7.1]
  def change
    create_table :workflows, id: :uuid do |t|
      t.references :workspace, type: :uuid, null: false, foreign_key: true
      t.string :title, null: false
      t.string :application
      t.string :signature, null: false
      t.integer :occurrences, default: 0
      t.float :confidence, default: 0.0
      t.datetime :last_seen_at
      t.string :status, null: false, default: "pending"
      t.timestamps
    end
    add_index :workflows, %i[workspace_id signature], unique: true
    add_index :workflows, :status
  end
end
