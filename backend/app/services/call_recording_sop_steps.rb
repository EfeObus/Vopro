# frozen_string_literal: true

# Normalizes ai-engine JSON into Sop `steps` JSONB (string keys, required fields).
class CallRecordingSopSteps
  def self.normalize(raw)
    Array(raw).filter_map.with_index do |step, idx|
      next unless step.is_a?(Hash) || step.respond_to?(:to_unsafe_h)

      h = step.respond_to?(:stringify_keys) ? step.stringify_keys : step.to_unsafe_h.to_h.stringify_keys
      out = {
        "id" => h["id"].to_s.presence || "s#{idx + 1}",
        "order" => (h["order"].presence || idx + 1).to_i,
        "title" => h["title"].to_s.presence || "Step #{idx + 1}",
        "description" => h["description"].to_s
      }
      out["application"] = h["application"] if h.key?("application") && h["application"].present?
      out["decision"] = h["decision"] if h["decision"].is_a?(Hash)
      out
    end
  end
end
