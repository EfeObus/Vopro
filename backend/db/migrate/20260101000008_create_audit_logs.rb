class CreateAuditLogs < ActiveRecord::Migration[7.1]
  def change
    create_table :audit_logs, id: :uuid do |t|
      t.references :workspace, type: :uuid, null: false, foreign_key: true
      t.references :user, type: :uuid, foreign_key: true
      t.string :action, null: false
      t.string :subject_type, null: false
      t.uuid :subject_id
      t.jsonb :metadata, default: {}, null: false
      t.timestamps
    end
    add_index :audit_logs, %i[workspace_id created_at]
    add_index :audit_logs, %i[subject_type subject_id]
  end
end
