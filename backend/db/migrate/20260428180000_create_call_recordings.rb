# frozen_string_literal: true

class CreateCallRecordings < ActiveRecord::Migration[7.1]
  def change
    create_table :call_recordings, id: :uuid do |t|
      t.references :workspace, type: :uuid, null: false, foreign_key: true
      t.references :user, type: :uuid, null: false, foreign_key: true
      t.references :sop, type: :uuid, foreign_key: true
      t.string :status, null: false, default: "pending"
      t.text :transcript
      t.string :title_hint
      t.string :error_message
      t.string :audio_file_path
      t.string :audio_content_type
      t.bigint :audio_byte_size
      t.jsonb :metadata, default: {}, null: false

      t.timestamps
    end

    add_index :call_recordings, %i[workspace_id created_at], order: { created_at: :desc }
  end
end
