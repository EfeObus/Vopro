module Vopro
  module Seeds
    module DemoData
      module_function

      def call
        workspace = Workspace.find_or_create_by!(slug: "demo") do |ws|
          ws.name = "Demo Workspace"
          ws.settings = { "retention_days" => 30 }
        end

        users = seed_users(workspace)
        seed_integrations(workspace)
        seed_workflows_and_sops(workspace, users)
        seed_recent_events(workspace, users)

        puts "Seeded:"
        puts "  workspace = #{workspace.slug}"
        puts "  users     = #{workspace.users.count}"
        puts "  workflows = #{workspace.workflows.count}"
        puts "  sops      = #{workspace.sops.count}"
        puts "  events    = #{workspace.workflow_events.count}"
        puts ""
        puts "Login: admin@vopro.local / vopro1234"
      end

      def seed_users(workspace)
        records = [
          { email: "admin@vopro.local",   name: "Demo Admin",     role: "admin" },
          { email: "amaka@vopro.local",   name: "Amaka Okeke",    role: "editor" },
          { email: "ravi@vopro.local",    name: "Ravi Shah",      role: "editor" },
          { email: "lena@vopro.local",    name: "Lena Park",      role: "editor" },
          { email: "daniel@vopro.local",  name: "Daniel Boateng", role: "editor" }
        ]
        records.map do |attrs|
          User.find_or_initialize_by(email: attrs[:email]).tap do |u|
            u.workspace = workspace
            u.name = attrs[:name]
            u.role = attrs[:role]
            u.password = "vopro1234"
            u.save!
          end
        end
      end

      def seed_integrations(workspace)
        [
          { provider: "google",     status: "connected" },
          { provider: "microsoft",  status: "disconnected" },
          { provider: "salesforce", status: "connected" },
          { provider: "zendesk",    status: "connected" },
          { provider: "notion",     status: "disconnected" },
          { provider: "slack",      status: "connected" },
          { provider: "rest",       status: "disconnected" }
        ].each do |attrs|
          integ = workspace.integrations.find_or_initialize_by(provider: attrs[:provider])
          integ.status = attrs[:status]
          integ.settings ||= {}
          integ.save!
        end
      end

      def seed_workflows_and_sops(workspace, users)
        amaka, ravi, lena, daniel = users.values_at(1, 2, 3, 4)
        sop_specs = [
          {
            owner: amaka,
            workflow_title: "Onboard a new enterprise customer in Salesforce",
            workflow_app: "Salesforce",
            sop_title: "Onboard a new enterprise customer in Salesforce",
            description: "End-to-end process for converting a closed-won opportunity into a fully provisioned customer account, including welcome email and CSM handoff.",
            status: "published",
            tags: %w[Salesforce CustomerSuccess Onboarding],
            confidence: 0.94,
            runs_observed: 142,
            contributors: 6,
            average_duration_sec: 612,
            steps: [
              { id: "s1", order: 1, title: "Open the closed-won opportunity in Salesforce",
                description: "Navigate to Opportunities → Closed Won. Select the most recent record.", application: "Salesforce" },
              { id: "s2", order: 2, title: "Convert opportunity to account",
                description: "Click Convert. Confirm billing contact, MRR, and renewal terms are populated.", application: "Salesforce" },
              { id: "s3", order: 3, title: "Provision tenant in admin console",
                description: "In the internal admin console, click 'New tenant' and paste the account ID.", application: "Internal Admin" },
              { id: "s4", order: 4, title: "Decide which path to take",
                description: "If MRR ≥ $5,000, route to white-glove. Otherwise self-serve.", application: "Salesforce",
                decision: { question: "Is contract MRR at or above $5,000?",
                            branches: [{ label: "Yes — white-glove", go_to_step_id: "s5a" },
                                       { label: "No — self-serve",   go_to_step_id: "s5b" }] } },
              { id: "s5a", order: 5, title: "Schedule kickoff with CSM",
                description: "Send the customer a Calendly link for a 30-minute kickoff. CC the assigned CSM.", application: "Gmail" },
              { id: "s5b", order: 5, title: "Send self-serve welcome email",
                description: "Use the 'Self-Serve Welcome' template. Verify the customer name token before sending.", application: "Gmail" },
              { id: "s6", order: 6, title: "Mark opportunity as 'Provisioned'",
                description: "Back in Salesforce, set Stage = Provisioned and add a Won note with the tenant ID.", application: "Salesforce" }
            ],
            versions: [
              { version: 3, authored_by: "Amaka Okeke", summary: "Added decision branch for white-glove vs self-serve.", offset_days: 5 },
              { version: 2, authored_by: "Vopro AI",    summary: "Auto-update: 3 steps reordered to match observed flow.", offset_days: 28 },
              { version: 1, authored_by: "Vopro AI",    summary: "Initial SOP generated from 28 captured runs.", offset_days: 73 }
            ]
          },
          {
            owner: ravi,
            workflow_title: "Weekly AP invoice review and approval",
            workflow_app: "NetSuite",
            sop_title: "Weekly AP invoice review and approval",
            description: "Reviews invoices in NetSuite, cross-checks against POs, and routes for approval. Includes the exception path for invoices > $25k.",
            status: "needs_review",
            tags: %w[Finance NetSuite AP],
            confidence: 0.81,
            runs_observed: 56,
            contributors: 3,
            average_duration_sec: 1840,
            steps: [
              { id: "i1", order: 1, title: "Open AP queue in NetSuite", description: "Filter by status = Pending.", application: "NetSuite" },
              { id: "i2", order: 2, title: "Match invoice to PO", description: "Open each invoice and compare line items against the linked PO.", application: "NetSuite" },
              { id: "i3", order: 3, title: "Decide which path to take",
                description: "Invoices over $25k require Director sign-off.", application: "NetSuite",
                decision: { question: "Is invoice ≥ $25,000?",
                            branches: [{ label: "Yes", go_to_step_id: "i4a" }, { label: "No", go_to_step_id: "i4b" }] } },
              { id: "i4a", order: 4, title: "Route to Director in Slack #ap-approvals", description: "Tag the Director with the invoice number and PO link.", application: "Slack" },
              { id: "i4b", order: 4, title: "Approve in NetSuite", description: "Click Approve and confirm payment date.", application: "NetSuite" }
            ],
            versions: [
              { version: 2, authored_by: "Vopro AI", summary: "Detected new exception path for invoices ≥ $25k. Marked for review.", offset_days: 2 },
              { version: 1, authored_by: "Ravi Shah", summary: "Manually authored from existing playbook.", offset_days: 54 }
            ]
          },
          {
            owner: lena,
            workflow_title: "Tier-1 support ticket triage in Zendesk",
            workflow_app: "Zendesk",
            sop_title: "Tier-1 support ticket triage in Zendesk",
            description: "Initial response, tagging, and escalation routing for newly opened support tickets.",
            status: "published",
            tags: %w[Support Zendesk],
            confidence: 0.97,
            runs_observed: 488,
            contributors: 9,
            average_duration_sec: 240,
            steps: [
              { id: "t1", order: 1, title: "Open new ticket queue", description: "Filter Zendesk by Status = New.", application: "Zendesk" },
              { id: "t2", order: 2, title: "Apply customer tier tag", description: "Look up the requester in our CRM. Apply the matching tier tag.", application: "Zendesk" },
              { id: "t3", order: 3, title: "Send first-response macro", description: "Use the 'T1 Acknowledge' macro.", application: "Zendesk" },
              { id: "t4", order: 4, title: "Decide which path to take",
                description: "Anything with stack traces or 5xx responses goes to engineering.", application: "Zendesk",
                decision: { question: "Does the ticket include stack traces or 5xx errors?",
                            branches: [{ label: "Yes", go_to_step_id: "t5a" }, { label: "No", go_to_step_id: "t5b" }] } },
              { id: "t5a", order: 5, title: "Escalate to engineering on-call", description: "Apply tag 'eng-escalation'. Page on-call via Slack.", application: "Slack" },
              { id: "t5b", order: 5, title: "Assign to T1 pod", description: "Round-robin via the assigned trigger.", application: "Zendesk" }
            ],
            versions: [
              { version: 1, authored_by: "Vopro AI", summary: "Generated from 412 captured runs.", offset_days: 8 }
            ]
          },
          {
            owner: daniel,
            workflow_title: "Bi-weekly payroll close in Gusto",
            workflow_app: "Gusto",
            sop_title: "Bi-weekly payroll close in Gusto",
            description: "Reviews timesheets, applies adjustments, and runs payroll.",
            status: "draft",
            tags: %w[Finance Payroll Gusto],
            confidence: 0.62,
            runs_observed: 14,
            contributors: 2,
            average_duration_sec: 2640,
            steps: [
              { id: "p1", order: 1, title: "Export timesheets from Deputy", description: "Date range = previous two weeks.", application: "Deputy" },
              { id: "p2", order: 2, title: "Review flagged hours", description: "Anything > 50h/week or < 5h/week needs verification with the manager.", application: "Deputy" },
              { id: "p3", order: 3, title: "Import into Gusto", description: "Use the CSV template from Deputy export.", application: "Gusto" },
              { id: "p4", order: 4, title: "Run payroll", description: "Click Submit Payroll. Confirm total and fund date.", application: "Gusto" }
            ],
            versions: [
              { version: 1, authored_by: "Vopro AI", summary: "Initial draft. Confidence 62% — needs more runs.", offset_days: 1 }
            ]
          }
        ]

        sop_specs.each do |spec|
          workflow = workspace.workflows.find_or_initialize_by(signature: signature_for(spec[:workflow_title]))
          workflow.assign_attributes(
            title: spec[:workflow_title],
            application: spec[:workflow_app],
            occurrences: spec[:runs_observed],
            confidence: spec[:confidence],
            last_seen_at: rand(2..72).hours.ago,
            status: "sop_generated"
          )
          workflow.save!

          sop = workspace.sops.find_or_initialize_by(workflow_id: workflow.id)
          sop.assign_attributes(
            owner: spec[:owner],
            title: spec[:sop_title],
            description: spec[:description],
            status: spec[:status],
            tags: spec[:tags],
            steps: spec[:steps],
            confidence: spec[:confidence],
            runs_observed: spec[:runs_observed],
            contributors: spec[:contributors],
            average_duration_sec: spec[:average_duration_sec]
          )
          sop.save!

          spec[:versions].each do |v|
            existing = sop.sop_versions.find_by(version: v[:version])
            next if existing

            SopVersion.create!(
              sop: sop,
              version: v[:version],
              authored_by: v[:authored_by],
              summary: v[:summary],
              snapshot: sop.as_versioned_snapshot,
              created_at: v[:offset_days].days.ago,
              updated_at: v[:offset_days].days.ago
            )
          end
        end

        # A few "detected but not yet generated" workflows so the
        # /workflows page has rows to act on.
        detected = [
          { title: "Refund issued via Stripe + Zendesk", app: "Stripe / Zendesk", occ: 38, conf: 0.88, hours_ago: 21 },
          { title: "Vendor security review questionnaire", app: "Notion / Gmail", occ: 12, conf: 0.71, hours_ago: 50 },
          { title: "New hire equipment provisioning", app: "Jamf / Okta",        occ: 24, conf: 0.92, hours_ago: 71 },
          { title: "Quarterly board deck assembly", app: "Google Drive",          occ: 4,  conf: 0.55, hours_ago: 168 }
        ]
        detected.each do |w|
          wf = workspace.workflows.find_or_initialize_by(signature: signature_for(w[:title]))
          wf.assign_attributes(
            title: w[:title],
            application: w[:app],
            occurrences: w[:occ],
            confidence: w[:conf],
            last_seen_at: w[:hours_ago].hours.ago,
            status: "pending"
          )
          wf.save!
        end
      end

      def seed_recent_events(workspace, users)
        # Light synthetic event stream over the last 7 days so the analytics
        # endpoint has something to chew on, plus deliberate decision-fork
        # branches so RefreshSopJob and the bottlenecks view have data to
        # latch onto.
        existing = workspace.workflow_events.count
        return if existing > 100 # idempotent guard

        events = []
        events.concat(triage_events(workspace, users))
        events.concat(ap_invoice_decision_events(workspace, users))
        events.concat(onboarding_decision_events(workspace, users))

        WorkflowEvent.insert_all(events) if events.any?
      end

      # Tier-1 triage: simple linear flow over a week.
      def triage_events(workspace, users)
        triage_workflow = workspace.workflows.find_by(application: "Zendesk")
        author = users[3] # Lena
        return [] unless triage_workflow && author

        events = []
        7.times do |day_offset|
          day = day_offset.days.ago.beginning_of_day
          runs_today = [124, 156, 142, 188, 174, 56, 41][day_offset] / 8
          runs_today.times do |i|
            t = day + (i * 3.minutes) + (rand(60).seconds)
            [
              { kind: "navigation",  target: "/tickets",         occurred_at: t },
              { kind: "click",       target: "Apply T1 macro",   occurred_at: t + 30.seconds },
              { kind: "form_submit", target: "Reply",            occurred_at: t + 60.seconds }
            ].each do |e|
              events << base_event(workspace, author, triage_workflow, e, "Zendesk")
            end
          end
        end
        events
      end

      # AP invoice review: decision fork on invoice >= $25k. Roughly 70% take
      # the "Approve in NetSuite" branch, 30% are routed to Slack approvals.
      def ap_invoice_decision_events(workspace, users)
        ap_workflow = workspace.workflows.find_by(application: "NetSuite")
        author = users[2] # Ravi
        return [] unless ap_workflow && author

        events = []
        # Five review sessions per week, distributed Mon–Fri.
        5.times do |day_offset|
          day = (day_offset + 1).days.ago.beginning_of_day + 9.hours
          15.times do |i|
            t = day + (i * 5.minutes)
            high_value = (i % 10) < 3 # ~30%

            events << base_event(workspace, author, ap_workflow,
              { kind: "navigation", target: "/ap-queue", occurred_at: t }, "NetSuite")
            events << base_event(workspace, author, ap_workflow,
              { kind: "click", target: "Match invoice to PO", occurred_at: t + 60.seconds,
                payload: { decision_question: "Is invoice ≥ $25,000?",
                           decision_branch: high_value ? "Yes" : "No" } },
              "NetSuite")

            if high_value
              events << base_event(workspace, author, ap_workflow,
                { kind: "navigation", target: "Slack: #ap-approvals",
                  occurred_at: t + 4.minutes }, "Slack")
              events << base_event(workspace, author, ap_workflow,
                { kind: "form_submit", target: "Route to Director",
                  occurred_at: t + 5.minutes,
                  payload: { decision_branch: "Yes" } }, "Slack")
            else
              events << base_event(workspace, author, ap_workflow,
                { kind: "click", target: "Approve in NetSuite",
                  occurred_at: t + 2.minutes,
                  payload: { decision_branch: "No" } }, "NetSuite")
            end
          end
        end
        events
      end

      # Customer onboarding: decision fork on MRR >= $5k between white-glove
      # and self-serve. Roughly 40% take the white-glove path.
      def onboarding_decision_events(workspace, users)
        onboarding = workspace.workflows.find_by(application: "Salesforce")
        author = users[1] # Amaka
        return [] unless onboarding && author

        events = []
        7.times do |day_offset|
          day = day_offset.days.ago.beginning_of_day + 14.hours
          4.times do |i|
            t = day + (i * 20.minutes)
            white_glove = (i % 5) < 2 # 40%

            events << base_event(workspace, author, onboarding,
              { kind: "navigation", target: "Opportunities → Closed Won",
                occurred_at: t }, "Salesforce")
            events << base_event(workspace, author, onboarding,
              { kind: "click", target: "Convert opportunity",
                occurred_at: t + 1.minute,
                payload: { decision_question: "Is contract MRR ≥ $5,000?",
                           decision_branch: white_glove ? "Yes — white-glove" : "No — self-serve" } },
              "Salesforce")

            if white_glove
              events << base_event(workspace, author, onboarding,
                { kind: "form_submit", target: "Send Calendly kickoff",
                  occurred_at: t + 6.minutes,
                  payload: { decision_branch: "Yes — white-glove" } }, "Gmail")
            else
              events << base_event(workspace, author, onboarding,
                { kind: "form_submit", target: "Self-Serve Welcome template",
                  occurred_at: t + 3.minutes,
                  payload: { decision_branch: "No — self-serve" } }, "Gmail")
            end

            events << base_event(workspace, author, onboarding,
              { kind: "click", target: "Mark opportunity Provisioned",
                occurred_at: t + 10.minutes }, "Salesforce")
          end
        end
        events
      end

      def base_event(workspace, user, workflow, attrs, application)
        {
          workspace_id: workspace.id,
          user_id: user.id,
          workflow_id: workflow.id,
          kind: attrs[:kind],
          application: application,
          target: attrs[:target],
          payload: attrs[:payload] || {},
          occurred_at: attrs[:occurred_at],
          created_at: attrs[:occurred_at],
          updated_at: attrs[:occurred_at]
        }
      end

      def signature_for(title)
        Digest::SHA256.hexdigest(title.downcase)[0, 16]
      end
    end
  end
end
