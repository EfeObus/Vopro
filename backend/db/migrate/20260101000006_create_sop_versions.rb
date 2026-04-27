class CreateSopVersions < ActiveRecord::Migration[7.1]
  def change
    create_table :sop_versions, id: :uuid do |t|
      t.references :sop, type: :uuid, null: false, foreign_key: true
      t.integer :version, null: false
      t.string :authored_by, null: false
      t.string :summary
      t.jsonb :snapshot, default: {}, null: false
      t.timestamps
    end
    add_index :sop_versions, %i[sop_id version], unique: true
  end
end
