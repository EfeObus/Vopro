class SopExporter
  def self.call(sop, format: :markdown)
    new(sop).export(format)
  end

  def initialize(sop)
    @sop = sop
  end

  def export(format)
    case format
    when :markdown then to_markdown
    when :json     then sop_to_json
    when :pdf      then to_pdf
    else
      raise ArgumentError, "Unsupported format: #{format}"
    end
  end

  private

  def sop_to_json
    {
      id: @sop.id,
      title: @sop.title,
      description: @sop.description,
      status: @sop.status,
      tags: @sop.tags,
      steps: @sop.steps,
      confidence: @sop.confidence
    }.to_json
  end

  def to_markdown
    lines = []
    lines << "# #{@sop.title}"
    lines << ""
    lines << @sop.description.to_s
    lines << ""
    lines << "**Status:** #{@sop.status}  "
    lines << "**Tags:** #{Array(@sop.tags).join(', ')}  "
    lines << "**Confidence:** #{(@sop.confidence.to_f * 100).round}%"
    lines << ""
    lines << "## Steps"
    Array(@sop.steps).each_with_index do |step, idx|
      lines << ""
      lines << "### #{idx + 1}. #{step['title']}"
      lines << ""
      lines << step["description"].to_s
      if step["application"]
        lines << ""
        lines << "_Application: #{step['application']}_"
      end
      if (decision = step["decision"])
        lines << ""
        lines << "**Decision:** #{decision['question']}"
        Array(decision["branches"]).each do |branch|
          lines << "- #{branch['label']}"
        end
      end
    end
    lines.join("\n")
  end

  def to_pdf
    # Placeholder. In production we'd use Prawn or wicked_pdf. For the MVP we
    # emit Markdown bytes inside a PDF header so clients can detect the format
    # change later.
    "%PDF-1.4\n% Vopro PDF placeholder\n#{to_markdown}"
  end
end
