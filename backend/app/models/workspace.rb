class Workspace < ApplicationRecord
  has_many :users, dependent: :destroy
  has_many :workflows, dependent: :destroy
  has_many :workflow_events, dependent: :destroy
  has_many :sops, dependent: :destroy
  has_many :integrations, dependent: :destroy
  has_many :audit_logs, dependent: :destroy

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true
end
