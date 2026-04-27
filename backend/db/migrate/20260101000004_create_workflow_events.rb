class CreateWorkflowEvents < ActiveRecord::Migration[7.1]
  def change
    create_table :workflow_events, id: :uuid do |t|
      t.references :workspace, type: :uuid, null: false, foreign_key: true
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :workflow, type: :uuid, foreign_key: true
      t.uuid :device_id
      t.string :kind, null: false
      t.string :application
      t.string :url
      t.string :target
      t.jsonb :payload, default: {}, null: false
      t.datetime :occurred_at, null: false
      t.timestamps
    end
    add_index :workflow_events, :occurred_at
    add_index :workflow_events, %i[workspace_id occurred_at]
    add_index :workflow_events, :payload, using: :gin
  end
end
