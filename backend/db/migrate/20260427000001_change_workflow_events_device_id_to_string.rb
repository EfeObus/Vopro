class ChangeWorkflowEventsDeviceIdToString < ActiveRecord::Migration[7.1]
  # The agent (and now the Chrome extension) sends an opaque device id of up
  # to 64 characters that may not be a UUID. The original schema typed
  # `device_id` as `uuid`, which would silently truncate or fail on insert
  # for non-UUID values. Convert in place and add the lookup index used by
  # rack-attack and per-device analytics.

  def up
    change_column :workflow_events, :device_id, :string, using: "device_id::text"
    add_index :workflow_events, [:workspace_id, :device_id, :occurred_at],
              name: "idx_workflow_events_on_workspace_device_time"
  end

  def down
    remove_index :workflow_events, name: "idx_workflow_events_on_workspace_device_time"
    change_column :workflow_events, :device_id, :uuid,
                  using: "CASE WHEN device_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN device_id::uuid ELSE NULL END"
  end
end
