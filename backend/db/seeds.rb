# Demo seed. Mirrors the realistic dataset the frontend renders in offline
# mode so the dashboard works identically when pointed at this API.
#
# Idempotent: running `bin/rails db:seed` twice produces the same final
# state.

require_relative "seeds/demo_data"

ActiveRecord::Base.logger.silence do
  Vopro::Seeds::DemoData.call
end

puts "Seed complete."
