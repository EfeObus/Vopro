FROM ruby:3.2-slim

ENV BUNDLE_PATH=/usr/local/bundle
ENV BUNDLE_JOBS=4

RUN apt-get update -qq \
 && apt-get install -y --no-install-recommends build-essential libpq-dev git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Gemfile Gemfile.lock* ./
RUN bundle install || bundle install

COPY . .

EXPOSE 3000
CMD ["bin/rails", "server", "-b", "0.0.0.0", "-p", "3000"]
