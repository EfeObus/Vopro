# Billing (Stripe)

Production deployments typically use **Stripe** for subscriptions, trials, and the customer portal. This repo does not ship a full billing UI yet; when you integrate Stripe:

1. Create products and prices in the Stripe Dashboard (test mode first).
2. Set the variables listed under **Billing** in [`.env.example`](../.env.example): secret key, publishable key, webhook secret, and price IDs for each plan tier you expose.
3. Implement webhook handlers to stay in sync with `Workspace` billing fields (`billing_plan`, trial dates, seat limits) and to gate features consistently with the backend.

Keep webhook endpoints idempotent and verify signatures using `STRIPE_WEBHOOK_SECRET`. Rotate keys if they appear in logs or leave your secrets manager.
