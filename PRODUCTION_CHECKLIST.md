# DecidePlease Production Readiness Checklist

This document outlines everything needed to take DecidePlease live with proper branding, payment processing, and infrastructure.

---

## Table of Contents
1. [Stripe Configuration](#1-stripe-configuration)
2. [Domain & DNS Setup](#2-domain--dns-setup)
3. [Render Deployment](#3-render-deployment)
4. [Environment Variables](#4-environment-variables)
5. [Email Configuration](#5-email-configuration)
6. [OAuth Configuration](#6-oauth-configuration)
7. [Development Tasks Required](#7-development-tasks-required)
8. [Pre-Launch Verification](#8-pre-launch-verification)

---

## 1. Stripe Configuration

### 1.1 Shared Stripe Account Setup

DecidePlease uses a **shared Stripe account** (Postalzap LLC) with other apps. This approach provides:
- ✅ Per-transaction statement descriptors (card statements show "DECIDEPLEASE")
- ✅ Custom checkout UI (your branding, not Stripe-hosted)
- ✅ Custom emails via Resend (DecidePlease branding)
- ✅ Metadata tracking to filter DecidePlease transactions
- ⚠️ Apple Pay/Google Pay sheets show account DBA (shared across apps)
- ⚠️ Dispute communications use legal business name

**Note**: You can migrate to a separate Stripe account later if full branding isolation becomes necessary.

### 1.2 Business Profile Setup (Account-Level - Affects All Apps)
- [ ] Go to **Settings → Business → Public details**
  - **Legal business name**: Keep as `Postalzap LLC` (required for compliance)
  - **Doing business as (DBA)**: Set to `DecidePlease` (shown on Apple Pay/Google Pay)
  - Statement descriptor: `DECIDEPLEASE` (max 22 chars) - *Note: DecidePlease overrides this per-transaction*
  - Support email: Your shared support email

- [ ] **DO NOT change** Settings → Business → Branding (affects all apps on this account)

### 1.3 Disable Stripe Automated Emails (IMPORTANT)
Since account-level email branding would show shared branding:
- [ ] Go to **Settings → Emails → Customer emails**
- [ ] **Turn OFF** "Successful payments" receipts
- [ ] **Turn OFF** "Refunds" notifications
- DecidePlease sends its own branded emails via Resend

### 1.4 Create Subscription Products & Prices
- [ ] Go to **Products → Add product** (create 3 products)

**Starter Plan:**
  - Name: `DecidePlease - Starter`
  - Description: `150 Quick, 8 Standard, 1 Premium deliberation per month`
  - **Add Price**: $49.00/month (recurring)
  - Copy `price_xxxxx` → `STRIPE_STARTER_PRICE_ID`

**Professional Plan:**
  - Name: `DecidePlease - Professional`
  - Description: `400 Quick, 25 Standard, 5 Premium deliberations per month`
  - **Add Price**: $129.00/month (recurring)
  - Copy `price_xxxxx` → `STRIPE_PROFESSIONAL_PRICE_ID`

**Team Plan:**
  - Name: `DecidePlease - Team`
  - Description: `1000 Quick, 75 Standard, 20 Premium deliberations per month (3 seats)`
  - **Add Price**: $299.00/month (recurring)
  - Copy `price_xxxxx` → `STRIPE_TEAM_PRICE_ID`

**Additional Team Seat (add-on):**
  - Name: `DecidePlease - Additional Team Seat`
  - **Add Price**: $60.00/month (recurring)
  - Copy `price_xxxxx` → `STRIPE_TEAM_SEAT_PRICE_ID`

**Overage Products** (metered billing):
  - Create metered prices for standard/premium overages per plan tier

### 1.5 Enable Apple Pay
- [ ] Go to **Settings → Payments → Payment methods**
- [ ] Find **Apple Pay** and click **Enable**
- [ ] **Register your domain**:
  - Click "Add new domain"
  - Enter: `decideplease.com`
  - Download the verification file
  - **You must host this file at**: `https://decideplease.com/.well-known/apple-developer-merchantid-domain-association`
  - Stripe provides instructions for this
- [ ] Complete Apple Pay verification (usually instant)

### 1.6 Enable Google Pay
- [ ] Go to **Settings → Payments → Payment methods**
- [ ] Find **Google Pay** and click **Enable**
- [ ] No domain verification needed (automatic)

### 1.7 Enable Dynamic Payment Methods
- [ ] Go to **Settings → Payments → Payment methods**
- [ ] Enable **Dynamic payment methods** toggle
  - This allows Stripe to automatically show the best payment options based on customer's device/region

### 1.8 Get Live API Keys
- [ ] Toggle to **Live mode** (top right of Stripe Dashboard)
- [ ] Go to **Developers → API keys**
- [ ] Copy these values:
  - `Publishable key` → `pk_live_xxxxx` (for frontend)
  - `Secret key` → `sk_live_xxxxx` (for backend)

### 1.9 Configure Webhook
- [ ] Go to **Developers → Webhooks**
- [ ] Click **Add endpoint**
  - URL: `https://decideplease-api.onrender.com/api/payments/webhook`
  - Events to listen for:
    - `checkout.session.completed`
    - `payment_intent.succeeded`
    - `payment_intent.payment_failed`
    - `charge.refunded`
- [ ] Copy **Signing secret** → `whsec_xxxxx` (for `STRIPE_WEBHOOK_SECRET`)

### 1.10 Tracking DecidePlease Payments (Shared Account)

Since multiple apps share this Stripe account, DecidePlease uses **metadata** to identify its transactions:

**Metadata included on every Subscription/PaymentIntent:**
```json
{
  "app": "decideplease",
  "user_id": "<user_id>",
  "plan": "starter|professional|team",
  "billing_cycle": "monthly"
}
```

**Filter in Stripe Dashboard:**
1. Go to **Payments** (or **Customers**)
2. Click **+ Add filter**
3. Select **Metadata**
4. Enter: `app` = `decideplease`

**Filter via API:**
```python
# List all DecidePlease payments
stripe.PaymentIntent.list(
    limit=100,
    metadata={"app": "decideplease"}
)

# Search payments (more flexible)
stripe.PaymentIntent.search(
    query="metadata['app']:'decideplease'"
)
```

**Export for accounting:**
- Use Dashboard filters + Export to CSV
- Or use the API search to generate reports

---

## 2. Domain & DNS Setup

### 2.1 Domain Registration
- [ ] Ensure `decideplease.com` is registered and you have DNS access
- [ ] Note your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.)

### 2.2 DNS Records for Render
You'll add these AFTER deploying to Render (Render provides the exact values):

**For the frontend (decideplease):**
- [ ] Add CNAME record: `www` → `decideplease.onrender.com`
- [ ] Add CNAME record: `@` (root) → `decideplease.onrender.com` (or A records if required)

**For the API (decideplease-api):**
- [ ] Add CNAME record: `api` → `decideplease-api.onrender.com`
  (Or use Render's proxy rewrite - already configured in render.yaml)

### 2.3 DNS Records for Email (Resend)
- [ ] Add SPF record for email authentication
- [ ] Add DKIM records from Resend dashboard
- [ ] Add DMARC record for email security

### 2.4 Apple Pay Domain Verification File
- [ ] Host the Apple Pay verification file at:
  ```
  https://decideplease.com/.well-known/apple-developer-merchantid-domain-association
  ```
  - In Render: Add a route or put this file in `frontend/public/.well-known/`

---

## 3. Render Deployment

### 3.1 Initial Deployment
- [ ] Go to https://render.com and sign in
- [ ] Click **New** → **Blueprint**
- [ ] Connect your GitHub repository
- [ ] Select `render.yaml` from the repo
- [ ] Render will create:
  - `decideplease-api` (Backend)
  - `decideplease` (Frontend static site)
  - `decideplease-db` (PostgreSQL database)

### 3.2 Add Custom Domains
- [ ] Go to **decideplease** (frontend) → **Settings** → **Custom Domains**
  - Add `decideplease.com`
  - Add `www.decideplease.com`
  - Follow Render's DNS instructions

- [ ] Enable **HTTPS** (automatic with Let's Encrypt)

### 3.3 Update API URL in Frontend
After deployment, update the API URL if using a custom domain:
- [ ] In Render, go to **decideplease** → **Environment**
- [ ] Set `VITE_API_URL` to your API URL:
  - If using Render proxy: Leave as `https://decideplease-api.onrender.com`
  - If using custom subdomain: `https://api.decideplease.com`

---

## 4. Environment Variables

### 4.1 Backend Environment Variables (Set in Render Dashboard)

**Required:**
| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Auto-set by Render | From decideplease-db |
| `JWT_SECRET` | Generate with `openssl rand -hex 32` | Keep secret! |
| `OPENROUTER_API_KEY` | Your OpenRouter API key | For AI models |
| `STRIPE_SECRET_KEY` | `sk_live_xxxxx` | Live secret key |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_xxxxx` | Live publishable key |
| `STRIPE_STARTER_PRICE_ID` | `price_xxxxx` | Starter plan ($49/mo) |
| `STRIPE_PROFESSIONAL_PRICE_ID` | `price_xxxxx` | Professional plan ($129/mo) |
| `STRIPE_TEAM_PRICE_ID` | `price_xxxxx` | Team plan ($299/mo) |
| `STRIPE_TEAM_SEAT_PRICE_ID` | `price_xxxxx` | Additional seat ($60/mo) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxxxx` | From step 1.9 |
| `STRIPE_STATEMENT_DESCRIPTOR` | `DECIDEPLEASE` | Max 22 chars |
| `RESEND_API_KEY` | `re_xxxxx` | For branded emails |
| `RESEND_FROM_EMAIL` | `DecidePlease <noreply@decideplease.com>` | |
| `APP_URL` | `https://decideplease.com` | |
| `CORS_ORIGINS` | `https://decideplease.com,https://www.decideplease.com` | |

**Optional:**
| Variable | Value | Notes |
|----------|-------|-------|
| `ADMIN_EMAILS` | `you@example.com,other@example.com` | Comma-separated superadmins |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console | For Google OAuth |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console | For Google OAuth |

### 4.2 Frontend Environment Variables
| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://decideplease-api.onrender.com` |

---

## 5. Email Configuration (Resend)

### 5.1 Resend Setup
- [ ] Go to https://resend.com and create an account
- [ ] Add domain `decideplease.com`
- [ ] Add required DNS records (SPF, DKIM, DMARC)
- [ ] Verify domain
- [ ] Create API key → `re_xxxxx`

### 5.2 Email Types Sent
The app sends these DecidePlease-branded emails:
- Welcome email (on registration)
- Password changed notification
- Password reset link
- Subscription confirmation (new subscriber)
- Subscription upgraded/downgraded
- Subscription renewal reminder
- Subscription canceled
- Overage charge notification
- Quota warning (approaching limit)
- Payment failed / retry notification

---

## 6. OAuth Configuration (Google Sign-In)

### 6.1 Google Cloud Console Setup
- [ ] Go to https://console.cloud.google.com
- [ ] Create new project: "DecidePlease"
- [ ] Go to **APIs & Services → OAuth consent screen**
  - User Type: External
  - App name: `DecidePlease`
  - User support email: `support@decideplease.com`
  - App logo: Upload DecidePlease logo
  - Developer contact: Your email
  - **IMPORTANT**: Only DecidePlease branding should appear here

### 6.2 Create OAuth Credentials
- [ ] Go to **APIs & Services → Credentials**
- [ ] Click **Create Credentials → OAuth client ID**
  - Application type: Web application
  - Name: `DecidePlease Web`
  - Authorized redirect URIs:
    - `https://decideplease.com/auth/google/callback`
    - `http://localhost:5173/auth/google/callback` (for dev)
- [ ] Copy Client ID and Client Secret

### 6.3 Publish OAuth App
- [ ] Go back to **OAuth consent screen**
- [ ] Click **Publish App** to move from testing to production
- [ ] If you have under 100 users and don't request sensitive scopes, no verification needed

---

## 7. Development Tasks Required

### 7.1 Saved Payment Methods (NOT YET IMPLEMENTED)
The current implementation doesn't support saved cards. To add this:

- [ ] **Backend changes needed:**
  - Add endpoint: `GET /api/payments/methods` - List user's saved payment methods
  - Add endpoint: `POST /api/payments/methods` - Save a new payment method
  - Add endpoint: `DELETE /api/payments/methods/:id` - Delete a payment method
  - Store Stripe customer_id in users table (may already be tracked in payments)

- [ ] **Frontend changes needed:**
  - Add "Payment Methods" section to Settings page
  - Show list of saved cards with last 4 digits and expiry
  - Add "Delete" button for each card
  - Modify PurchaseModal to show saved cards first

- [ ] **Stripe API calls needed:**
  ```python
  # List payment methods
  stripe.PaymentMethod.list(customer=customer_id, type="card")

  # Attach new payment method
  stripe.PaymentMethod.attach(payment_method_id, customer=customer_id)

  # Detach (delete) payment method
  stripe.PaymentMethod.detach(payment_method_id)
  ```

### 7.2 Apple Pay Verification File Hosting
- [ ] Create file: `frontend/public/.well-known/apple-developer-merchantid-domain-association`
- [ ] Add content from Stripe (they provide this when you register the domain)
- [ ] Ensure Render serves this file correctly (may need route config)

---

## 8. Pre-Launch Verification

### 8.1 Test Payments (Use Test Mode First)
- [ ] Toggle Stripe to **Test mode**
- [ ] Use test card: `4242 4242 4242 4242`
- [ ] Verify purchase flow works
- [ ] Verify credits are added
- [ ] Verify webhook processes payment
- [ ] Verify purchase confirmation email is sent

### 8.2 Test Apple Pay (Requires Real Device)
- [ ] On iPhone/Mac Safari with Apple Pay configured
- [ ] Domain must be verified first
- [ ] Test in Stripe test mode initially

### 8.3 Test Google Pay
- [ ] On Chrome with Google Pay configured
- [ ] Test in Stripe test mode initially

### 8.4 Branding Verification
- [ ] Check your custom checkout page shows DecidePlease branding (not Stripe-hosted)
- [ ] Check card statement will show "DECIDEPLEASE"
- [ ] Check emails come from DecidePlease (via Resend, not Stripe)
- [ ] Check OAuth consent shows DecidePlease only
- [ ] **Expected exceptions** (shared account limitations):
  - Apple Pay/Google Pay payment sheets show account DBA
  - Dispute communications use legal business name

### 8.5 Go Live Checklist
- [ ] All tests passing (`npx playwright test`)
- [ ] Switch Stripe to Live mode
- [ ] Update all environment variables to live keys
- [ ] Test a real $0.50 purchase (create a test price or use coupon)
- [ ] Refund the test purchase
- [ ] Verify everything works
- [ ] Monitor Stripe Dashboard and application logs

---

## Quick Reference: Key URLs

| Service | URL |
|---------|-----|
| Stripe Dashboard | https://dashboard.stripe.com |
| Render Dashboard | https://dashboard.render.com |
| Resend Dashboard | https://resend.com/emails |
| Google Cloud Console | https://console.cloud.google.com |
| OpenRouter | https://openrouter.ai/keys |

---

## Estimated Costs & Revenue (Monthly)

### Infrastructure Costs
| Service | Cost |
|---------|------|
| Render Starter (API) | ~$7/month |
| Render Static (Frontend) | Free |
| Render PostgreSQL (Basic) | ~$7/month |
| Stripe | 2.9% + $0.30 per transaction |
| Resend | Free up to 3,000 emails/month |
| OpenRouter | Pay per API call (variable) |
| Domain | ~$12/year |

**Total Fixed Infrastructure**: ~$14/month + per-transaction fees

### Subscription Pricing
| Plan | Monthly Price | Quotas |
|------|---------------|--------|
| Starter | $49 | 150 quick, 8 standard, 1 premium |
| Professional | $129 | 400 quick, 25 standard, 5 premium |
| Team | $299 | 1000 quick, 75 standard, 20 premium (3 seats) |
| Additional Seat | +$60 | For Team plan |

### Overage Pricing (per run, when quota exceeded)
| Plan | Standard | Premium |
|------|----------|---------|
| Starter | $4.00 | $10.00 |
| Professional | $3.00 | $8.00 |
| Team | $2.50 | $6.00 |

*Note: Quick Decision runs have hard caps (no overages available)*

---

## Notes

1. **Shared Stripe Account Strategy**: DecidePlease uses a shared Stripe account (Postalzap LLC) with per-transaction branding:
   - ✅ Card statements show "DECIDEPLEASE" via per-transaction `statement_descriptor`
   - ✅ Emails branded via Resend (Stripe auto-emails disabled)
   - ✅ Custom checkout UI (no Stripe-hosted pages)
   - ✅ Metadata filtering: `app: "decideplease"` on all transactions
   - ⚠️ Apple Pay/Google Pay sheets show account DBA
   - ⚠️ Disputes use legal business name
   - **Future option**: Migrate to separate Stripe account if full branding isolation needed

2. **Saved Cards**: Already implemented with auto-fallback logic.

3. **Apple Pay**: Requires domain verification. Cannot be fully tested until the domain is live and verified with Stripe. Note: Shows account DBA, not per-transaction name.

4. **Google Pay**: Works automatically once enabled in Stripe Dashboard. No domain verification needed. Note: Shows account DBA, not per-transaction name.

5. **Tracking DecidePlease Payments**: Filter in Stripe Dashboard using metadata: `app = decideplease`. All PaymentIntents, CheckoutSessions, and Customers include this metadata.

