class ApplicationJob < ActiveJob::Base
  retry_on Net::ReadTimeout, wait: :polynomially_longer, attempts: 3
end
