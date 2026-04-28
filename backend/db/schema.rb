# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.1].define(version: 2026_04_27_000004) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pgcrypto"
  enable_extension "plpgsql"

  create_table "audit_logs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "workspace_id", null: false
    t.uuid "user_id"
    t.string "action", null: false
    t.string "subject_type", null: false
    t.uuid "subject_id"
    t.jsonb "metadata", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["subject_type", "subject_id"], name: "index_audit_logs_on_subject_type_and_subject_id"
    t.index ["user_id"], name: "index_audit_logs_on_user_id"
    t.index ["workspace_id", "created_at"], name: "index_audit_logs_on_workspace_id_and_created_at"
    t.index ["workspace_id"], name: "index_audit_logs_on_workspace_id"
  end

  create_table "integrations", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "workspace_id", null: false
    t.string "provider", null: false
    t.string "status", default: "disconnected", null: false
    t.jsonb "settings", default: {}, null: false
    t.text "secrets"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["workspace_id", "provider"], name: "index_integrations_on_workspace_id_and_provider", unique: true
    t.index ["workspace_id"], name: "index_integrations_on_workspace_id"
  end

  create_table "invitations", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "workspace_id", null: false
    t.uuid "inviter_id"
    t.string "email", null: false
    t.string "role", default: "viewer", null: false
    t.string "token", null: false
    t.datetime "expires_at", null: false
    t.datetime "accepted_at"
    t.datetime "revoked_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["inviter_id"], name: "index_invitations_on_inviter_id"
    t.index ["token"], name: "index_invitations_on_token", unique: true
    t.index ["workspace_id", "email"], name: "index_invitations_on_workspace_id_and_email"
    t.index ["workspace_id"], name: "index_invitations_on_workspace_id"
  end

  create_table "password_reset_tokens", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "user_id", null: false
    t.string "token", null: false
    t.datetime "expires_at", null: false
    t.datetime "consumed_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["token"], name: "index_password_reset_tokens_on_token", unique: true
    t.index ["user_id", "expires_at"], name: "index_password_reset_tokens_on_user_id_and_expires_at"
    t.index ["user_id"], name: "index_password_reset_tokens_on_user_id"
  end

  create_table "sop_versions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "sop_id", null: false
    t.integer "version", null: false
    t.string "authored_by", null: false
    t.string "summary"
    t.jsonb "snapshot", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["sop_id", "version"], name: "index_sop_versions_on_sop_id_and_version", unique: true
    t.index ["sop_id"], name: "index_sop_versions_on_sop_id"
  end

  create_table "sops", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "workspace_id", null: false
    t.uuid "owner_id"
    t.uuid "workflow_id"
    t.string "title", null: false
    t.text "description"
    t.string "status", default: "draft", null: false
    t.jsonb "tags", default: [], null: false
    t.jsonb "steps", default: [], null: false
    t.float "confidence", default: 0.0
    t.integer "runs_observed", default: 0
    t.integer "contributors", default: 0
    t.integer "average_duration_sec", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["owner_id"], name: "index_sops_on_owner_id"
    t.index ["status"], name: "index_sops_on_status"
    t.index ["tags"], name: "index_sops_on_tags", using: :gin
    t.index ["workflow_id"], name: "index_sops_on_workflow_id"
    t.index ["workspace_id"], name: "index_sops_on_workspace_id"
  end

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "workspace_id", null: false
    t.string "email", null: false
    t.string "password_digest", null: false
    t.string "name", null: false
    t.string "role", default: "viewer", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "deleted_at"
    t.index ["deleted_at"], name: "index_users_on_deleted_at"
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["workspace_id"], name: "index_users_on_workspace_id"
  end

  create_table "workflow_events", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "workspace_id", null: false
    t.uuid "user_id", null: false
    t.uuid "workflow_id"
    t.string "device_id"
    t.string "kind", null: false
    t.string "application"
    t.string "url"
    t.string "target"
    t.jsonb "payload", default: {}, null: false
    t.datetime "occurred_at", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["occurred_at"], name: "index_workflow_events_on_occurred_at"
    t.index ["payload"], name: "index_workflow_events_on_payload", using: :gin
    t.index ["user_id"], name: "index_workflow_events_on_user_id"
    t.index ["workflow_id"], name: "index_workflow_events_on_workflow_id"
    t.index ["workspace_id", "device_id", "occurred_at"], name: "idx_workflow_events_on_workspace_device_time"
    t.index ["workspace_id", "occurred_at"], name: "index_workflow_events_on_workspace_id_and_occurred_at"
    t.index ["workspace_id"], name: "index_workflow_events_on_workspace_id"
  end

  create_table "workflows", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.uuid "workspace_id", null: false
    t.string "title", null: false
    t.string "application"
    t.string "signature", null: false
    t.integer "occurrences", default: 0
    t.float "confidence", default: 0.0
    t.datetime "last_seen_at"
    t.string "status", default: "pending", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["status"], name: "index_workflows_on_status"
    t.index ["workspace_id", "signature"], name: "index_workflows_on_workspace_id_and_signature", unique: true
    t.index ["workspace_id"], name: "index_workflows_on_workspace_id"
  end

  create_table "workspaces", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "name", null: false
    t.string "slug", null: false
    t.jsonb "settings", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["slug"], name: "index_workspaces_on_slug", unique: true
  end

  add_foreign_key "audit_logs", "users"
  add_foreign_key "audit_logs", "workspaces"
  add_foreign_key "integrations", "workspaces"
  add_foreign_key "invitations", "users", column: "inviter_id"
  add_foreign_key "invitations", "workspaces"
  add_foreign_key "password_reset_tokens", "users"
  add_foreign_key "sop_versions", "sops"
  add_foreign_key "sops", "users", column: "owner_id"
  add_foreign_key "sops", "workflows"
  add_foreign_key "sops", "workspaces"
  add_foreign_key "users", "workspaces"
  add_foreign_key "workflow_events", "users"
  add_foreign_key "workflow_events", "workflows"
  add_foreign_key "workflow_events", "workspaces"
  add_foreign_key "workflows", "workspaces"
end
