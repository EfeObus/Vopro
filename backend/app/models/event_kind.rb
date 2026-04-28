module EventKind
  ALL = %w[
    click
    input
    navigation
    focus
    blur
    form_submit
    shortcut
    copy
    paste
    open
    close
  ].freeze

  ALL_SET = ALL.to_set.freeze

  def self.valid?(kind)
    ALL_SET.include?(kind.to_s)
  end
end
