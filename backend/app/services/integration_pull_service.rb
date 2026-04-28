# frozen_string_literal: true

require "digest"

# Pulls synthetic WorkflowEvents from connected OAuth integrations (Google,
# Microsoft) or a configured REST endpoint — runnable inside Sidekiq without
# shelling out to the Node connector package.
class IntegrationPullService
  class << self
    def sync!(integration)
      return :skipped unless integration.status == "connected"

      workspace = integration.workspace
      actor = workspace.users.where(role: %w[admin editor]).first || workspace.users.order(:created_at).first
      return :skipped unless actor

      creds = parse_secrets(integration)
      case integration.provider
      when "google"
        sync_google!(integration, workspace, actor, creds)
      when "microsoft"
        sync_microsoft!(integration, workspace, actor, creds)
      when "rest"
        sync_rest!(integration, workspace, actor, creds)
      else
        :skipped
      end
    end

    private

    def parse_secrets(integration)
      raw = integration.secrets
      return {} if raw.blank?

      JSON.parse(raw.to_s)
    rescue JSON::ParserError
      {}
    end

    def device_key(integration)
      "integration:#{integration.provider}:#{integration.id}"
    end

    def sync_google!(integration, workspace, actor, creds)
      rows = []
      fetch_google_files(integration, creds) do |file|
        next if duplicate_drive_file?(workspace, file["id"])

        occurred = parse_time(file["modifiedTime"]) || Time.current
        rows << event_row(
          workspace_id: workspace.id,
          user_id: actor.id,
          device_id: device_key(integration),
          kind: "open",
          application: "Google Drive",
          url: file["webViewLink"].to_s.first(2048),
          target: file["name"].to_s.first(500),
          occurred_at: occurred,
          payload: { source: "google_drive", file_id: file["id"] }
        )
      end

      insert_events!(rows)
      touch_integration!(integration)
      rows.any? ? :ok : :skipped
    end

    def fetch_google_files(integration, creds)
      token = google_access_token!(integration, creds)
      return unless token.present?

      res = HTTParty.get(
        "https://www.googleapis.com/drive/v3/files",
        query: {
          fields: "files(id,name,modifiedTime,webViewLink)",
          pageSize: 40,
          orderBy: "modifiedTime desc"
        },
        headers: { "Authorization" => "Bearer #{token}" },
        timeout: 25
      )

      if res.code == 401 && creds["refresh_token"].present?
        creds = google_refresh!(integration, creds)
        token = creds["access_token"]
        res = HTTParty.get(
          "https://www.googleapis.com/drive/v3/files",
          query: {
            fields: "files(id,name,modifiedTime,webViewLink)",
            pageSize: 40,
            orderBy: "modifiedTime desc"
          },
          headers: { "Authorization" => "Bearer #{token}" },
          timeout: 25
        ) if token.present?
      end

      unless res&.success?
        Rails.logger.warn("[integration-pull] google HTTP #{res&.code} for #{integration.id}")
        return
      end

      Array(res.parsed_response&.dig("files")).each { |f| yield f }
    end

    def google_access_token!(integration, creds)
      tok = creds["access_token"].presence
      return tok if tok.present?

      return nil unless creds["refresh_token"].present?

      refreshed = google_refresh!(integration, creds)
      refreshed["access_token"].presence
    end

    def google_refresh!(integration, creds)
      client_id = ENV.fetch("GOOGLE_CLIENT_ID", "").to_s
      client_secret = ENV.fetch("GOOGLE_CLIENT_SECRET", "").to_s
      return creds if client_id.blank? || creds["refresh_token"].blank?

      res = HTTParty.post(
        "https://oauth2.googleapis.com/token",
        body: {
          client_id: client_id,
          client_secret: client_secret,
          refresh_token: creds["refresh_token"],
          grant_type: "refresh_token"
        },
        headers: { "Content-Type" => "application/x-www-form-urlencoded" },
        timeout: 25
      )
      return creds unless res.success?

      merged = creds.merge(res.parsed_response)
      integration.update_column(:secrets, merged.to_json)
      merged
    rescue StandardError => e
      Rails.logger.warn("[integration-pull] google refresh failed: #{e.class}: #{e.message}")
      creds
    end

    def sync_microsoft!(integration, workspace, actor, creds)
      rows = []
      fetch_microsoft_recent(integration, creds) do |item|
        next if duplicate_onedrive_item?(workspace, item["id"])

        occurred = parse_time(item["lastModifiedDateTime"]) || Time.current
        rows << event_row(
          workspace_id: workspace.id,
          user_id: actor.id,
          device_id: device_key(integration),
          kind: "open",
          application: "OneDrive",
          url: item["webUrl"].to_s.first(2048),
          target: item["name"].to_s.first(500),
          occurred_at: occurred,
          payload: { source: "onedrive", item_id: item["id"] }
        )
      end

      insert_events!(rows)
      touch_integration!(integration)
      rows.any? ? :ok : :skipped
    end

    def fetch_microsoft_recent(integration, creds)
      token = creds["access_token"].presence
      return unless token.present?

      res = HTTParty.get(
        "https://graph.microsoft.com/v1.0/me/drive/recent",
        query: { "$top" => 40 },
        headers: { "Authorization" => "Bearer #{token}" },
        timeout: 25
      )

      if res.code == 401 && creds["refresh_token"].present?
        creds = microsoft_refresh!(integration, creds)
        token = creds["access_token"]
        res = HTTParty.get(
          "https://graph.microsoft.com/v1.0/me/drive/recent",
          query: { "$top" => 40 },
          headers: { "Authorization" => "Bearer #{token}" },
          timeout: 25
        ) if token.present?
      end

      unless res&.success?
        Rails.logger.warn("[integration-pull] microsoft HTTP #{res&.code} for #{integration.id}")
        return
      end

      Array(res.parsed_response&.dig("value")).each { |i| yield i }
    end

    def microsoft_refresh!(integration, creds)
      client_id = ENV.fetch("MICROSOFT_CLIENT_ID", "").to_s
      client_secret = ENV.fetch("MICROSOFT_CLIENT_SECRET", "").to_s
      return creds if client_id.blank? || creds["refresh_token"].blank?

      res = HTTParty.post(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        body: {
          client_id: client_id,
          client_secret: client_secret,
          refresh_token: creds["refresh_token"],
          grant_type: "refresh_token",
          scope: %w[offline_access Files.Read Calendars.Read Mail.Read].join(" ")
        },
        headers: { "Content-Type" => "application/x-www-form-urlencoded" },
        timeout: 25
      )
      return creds unless res.success?

      merged = creds.merge(res.parsed_response)
      integration.update_column(:secrets, merged.to_json)
      merged
    rescue StandardError => e
      Rails.logger.warn("[integration-pull] microsoft refresh failed: #{e.class}: #{e.message}")
      creds
    end

    def sync_rest!(integration, workspace, actor, creds)
      endpoint = integration.settings&.dig("endpoint").presence || creds["endpoint"].presence
      return :skipped unless endpoint.present?

      token = creds["api_key"].presence || creds["access_token"].presence
      headers = {}
      headers["Authorization"] = "Bearer #{token}" if token.present?

      res = HTTParty.get(endpoint.to_s, headers: headers, timeout: 30)
      unless res.success?
        Rails.logger.warn("[integration-pull] rest HTTP #{res.code} for #{integration.id}")
        return :error
      end

      body = res.parsed_response
      items =
        case body
        when Array then body
        when Hash then Array(body["events"] || body["items"])
        else []
        end

      rows = []
      items.each do |item|
        next unless item.is_a?(Hash)

        occurred = parse_time(item["occurredAt"] || item["occurred_at"]) || Time.current
        kind = (item["kind"].presence || "open")
        url = item["url"].to_s.first(2048)
        target = item["target"].to_s.first(500)
        dedupe_key = Digest::SHA256.hexdigest([kind, url, target, occurred.utc.iso8601].join("|"))
        next if duplicate_rest_row?(workspace, dedupe_key)

        base_payload = item["payload"].is_a?(Hash) ? item["payload"].dup : {}
        base_payload["dedupe_key"] = dedupe_key
        base_payload["source"] ||= "rest_pull"

        rows << event_row(
          workspace_id: workspace.id,
          user_id: actor.id,
          device_id: device_key(integration),
          kind: kind,
          application: item["application"].to_s.first(120),
          url: url,
          target: target,
          occurred_at: occurred,
          payload: base_payload
        )
      end

      insert_events!(rows)
      touch_integration!(integration)
      rows.any? ? :ok : :skipped
    end

    def event_row(workspace_id:, user_id:, device_id:, kind:, application:, url:, target:, occurred_at:, payload:)
      now = Time.current
      {
        workspace_id: workspace_id,
        user_id: user_id,
        workflow_id: nil,
        device_id: device_id.to_s.first(64),
        kind: kind,
        application: application,
        url: url,
        target: target,
        payload: MaskingService.scrub(payload || {}),
        occurred_at: occurred_at,
        created_at: now,
        updated_at: now
      }
    end

    def insert_events!(rows)
      return if rows.empty?

      WorkflowEvent.insert_all(rows)
    end

    def duplicate_drive_file?(workspace, file_id)
      return false if file_id.blank?

      workspace.workflow_events.where(kind: "open", application: "Google Drive")
                .where("payload ->> 'source' = ? AND payload ->> 'file_id' = ?", "google_drive", file_id)
                .exists?
    end

    def duplicate_onedrive_item?(workspace, item_id)
      return false if item_id.blank?

      workspace.workflow_events.where(kind: "open", application: "OneDrive")
                .where("payload ->> 'source' = ? AND payload ->> 'item_id' = ?", "onedrive", item_id)
                .exists?
    end

    def duplicate_rest_row?(workspace, dedupe_key)
      return false if dedupe_key.blank?

      workspace.workflow_events.where("payload ->> 'dedupe_key' = ?", dedupe_key).exists?
    end

    def parse_time(value)
      return if value.blank?

      Time.zone.parse(value.to_s)
    rescue ArgumentError
      nil
    end

    def touch_integration!(integration)
      integration.settings ||= {}
      integration.settings["last_pull_at"] = Time.current.iso8601
      integration.save!
    end
  end
end
