# DecidePlease Setup Guide

This guide walks you through setting up Clerk, Stripe, and deploying to Render.

---

## Step 1: Configure Clerk (Auth)

> Do this first - you need the keys before deploying

### 1.1 Create Clerk Application

1. Go to [clerk.com](https://clerk.com) and sign in
2. Click **"Add application"**
3. Name it: `DecidePlease`
4. For authentication methods, enable:
   - **Email** (required)
   - **Google** (recommended)
   - **Apple** (optional)

### 1.2 Get Your API Keys

After creating the app, go to **API Keys** in the left sidebar:

1. Copy **Publishable key** (starts with `pk_live_` or `pk_test_`)
   - This goes in Render as: `VITE_CLERK_PUBLISHABLE_KEY`

2. Copy **Secret key** (starts with `sk_live_` or `sk_test_`)
   - This goes in Render as: `CLERK_SECRET_KEY`

### 1.3 Get Your Issuer URL

Go to **API Keys** → Look for **Frontend API** URL:
- It looks like: `https://your-app-name.clerk.accounts.dev`
- This goes in Render as: `CLERK_ISSUER`

### 1.4 Configure OAuth (Google)

To enable "Sign in with Google":

1. Go to **User & Authentication** → **Social connections** → **Google**
2. Click **Configure**
3. You'll need to create a Google OAuth app:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Choose **Web application**
   - Add authorized redirect URI from Clerk dashboard
   - Copy Client ID and Client Secret back to Clerk

### 1.5 Set Allowed Origins

Go to **API Keys** → Scroll down to **Allowed origins**:
- Add: `https://decideplease.com`
- Add: `https://www.decideplease.com`
- Add: `http://localhost:5173` (for local development)

---

## Step 2: Configure Stripe (Payments)

### 2.1 Create Stripe Account

1. Go to [stripe.com](https://stripe.com) and sign up
2. Complete account verification (you can use test mode initially)

### 2.2 Get Your API Keys

1. Go to **Developers** → **API keys**
2. Copy **Secret key** (starts with `sk_test_` or `sk_live_`)
   - This goes in Render as: `STRIPE_SECRET_KEY`

### 2.3 Create a Product and Price

1. Go to **Products** → **Add product**
2. Set up your credit pack:
   - **Name**: "20 Credits"
   - **Price**: $5.00 (or your chosen price)
   - **One-time** payment
3. After creating, copy the **Price ID** (starts with `price_`)
   - This goes in Render as: `STRIPE_PRICE_ID`

### 2.4 Set Up Webhook (After Deployment)

After Render deployment, you need to configure the webhook:

1. Go to **Developers** → **Webhooks** → **Add endpoint**
2. Endpoint URL: `https://decideplease-api.onrender.com/api/webhooks/stripe`
3. Select events to listen to:
   - `checkout.session.completed` (for purchases)
   - `charge.refunded` (for refunds - optional)
4. Click **Add endpoint**
5. Copy the **Signing secret** (starts with `whsec_`)
   - This goes in Render as: `STRIPE_WEBHOOK_SECRET`

### 2.5 Configure Credit Pack (Optional)

You can customize the credit pack in Render environment variables:
- `CREDITS_PER_PURCHASE`: Number of credits per purchase (default: 20)
- `PRICE_DISPLAY`: Display price in UI (default: "$5.00")

---

## Step 3: Deploy to Render

### 3.1 Create Render Account

1. Go to [render.com](https://render.com) and sign up
2. Connect your GitHub account

### 3.2 Deploy Using Blueprint

1. In your repo, you should have the `render.yaml` file (already created)
2. Go to Render Dashboard → **New** → **Blueprint**
3. Select your `decideplease` repository
4. Click **Apply**

Render will create:
- `decideplease-api` - Backend web service ($7/month)
- `decideplease` - Frontend static site (Free)
- `decideplease-db` - PostgreSQL database ($7/month)

### 3.3 Set Environment Variables

After the services are created, you need to set the secret keys:

#### For `decideplease-api` (Backend):
Go to the service → **Environment** → Add:

| Key | Value |
|-----|-------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `CLERK_SECRET_KEY` | `sk_live_xxxx` from Clerk |
| `CLERK_ISSUER` | `https://your-app.clerk.accounts.dev` |
| `STRIPE_SECRET_KEY` | `sk_live_xxxx` from Stripe |
| `STRIPE_PRICE_ID` | `price_xxxx` from Stripe |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxxx` (after setting up webhook) |

#### For `decideplease` (Frontend):
Go to the service → **Environment** → Add:

| Key | Value |
|-----|-------|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_xxxx` from Clerk |

### 3.4 Trigger Redeploy

After adding environment variables:
1. Go to each service
2. Click **Manual Deploy** → **Deploy latest commit**

---

## Step 4: Configure DNS (Cloudflare)

### 4.1 Get Render's URL

1. Go to your `decideplease` static site in Render
2. Copy the `.onrender.com` URL (e.g., `decideplease.onrender.com`)

### 4.2 Add DNS Records in Cloudflare

1. Go to Cloudflare → Select `decideplease.com`
2. Go to **DNS** → **Records**
3. Add a CNAME record:
   - **Type**: CNAME
   - **Name**: `@` (or `decideplease.com`)
   - **Target**: `decideplease.onrender.com`
   - **Proxy status**: DNS only (gray cloud) initially

4. For www subdomain:
   - **Type**: CNAME
   - **Name**: `www`
   - **Target**: `decideplease.onrender.com`

### 4.3 Add Custom Domain in Render

1. Go to your `decideplease` static site in Render
2. Go to **Settings** → **Custom Domains**
3. Add: `decideplease.com`
4. Add: `www.decideplease.com`
5. Render will provide verification and SSL

---

## Step 5: Set Up Stripe Webhook

> Do this after the backend is deployed

1. Go to Stripe → **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://decideplease-api.onrender.com/api/webhooks/stripe`
4. Select event: `checkout.session.completed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (`whsec_...`)
7. Add it to Render backend as `STRIPE_WEBHOOK_SECRET`
8. Redeploy backend

---

## Step 6: Verify Everything Works

### 6.1 Test the Deployment

1. Go to `https://decideplease.com`
2. You should see the login screen
3. Sign up with email or Google
4. After signing in, you should see the chat interface
5. You should have 5 free credits

### 6.2 Test a Query

1. Click **+ New Conversation**
2. Ask a question
3. Verify all 3 stages complete successfully
4. Your credits should decrease by 1

### 6.3 Test Payments (Use Stripe Test Mode)

1. Use up your free credits or set credits to 0 in database
2. Click "Buy 20 credits for $5.00"
3. In Stripe checkout, use test card: `4242 4242 4242 4242`
4. Any future expiry, any CVC
5. After payment, you should be redirected and have credits added

---

## Environment Variables Summary

### Backend (`decideplease-api`)
```
OPENROUTER_API_KEY=sk-or-v1-xxxx
CLERK_SECRET_KEY=sk_live_xxxx
CLERK_ISSUER=https://your-app.clerk.accounts.dev
STRIPE_SECRET_KEY=sk_live_xxxx
STRIPE_PRICE_ID=price_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
DATABASE_URL=(auto-set by Render)
CORS_ORIGINS=https://decideplease.com,https://www.decideplease.com
ADMIN_EMAILS=you@example.com,employee@example.com
```

### Frontend (`decideplease`)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxx
```

---

## Local Development

To run locally:

1. Create `backend/.env`:
```
OPENROUTER_API_KEY=your-key
DEVELOPMENT_MODE=true
```

2. Create `frontend/.env.development`:
```
VITE_API_URL=http://localhost:8001
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxx
```

3. Run:
```bash
# Terminal 1 - Backend
cd backend
pip install -r ../requirements.txt
python -m uvicorn main:app --port 8001

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

Note: For local dev without Clerk, set `DEVELOPMENT_MODE=true` in backend .env to bypass auth.

---

## Troubleshooting

### "Not authenticated" error
- Check `CLERK_SECRET_KEY` and `CLERK_ISSUER` are set correctly in backend
- Check `VITE_CLERK_PUBLISHABLE_KEY` is set in frontend
- Make sure you redeployed after adding env vars

### CORS errors
- Check `CORS_ORIGINS` includes your domain with https://
- Make sure no trailing slashes

### Database connection errors
- `DATABASE_URL` should be auto-set by Render
- Check the database is running in Render dashboard

### Clerk login not working
- Verify allowed origins in Clerk dashboard
- Check browser console for errors

---

## Admin Panel

The admin panel is available at the bottom of the sidebar for users whose email is in the `ADMIN_EMAILS` environment variable.

### Features
- **Dashboard**: Total users, queries, revenue, and daily stats
- **Users**: Search users, view details, adjust credits manually
- **Payments**: View all Stripe payments
- **Queries**: See recent queries across all users

### Setting Up Admin Access
1. Add `ADMIN_EMAILS` to your backend environment:
   ```
   ADMIN_EMAILS=you@example.com,coworker@example.com
   ```
2. Redeploy the backend
3. Sign in with an admin email - you'll see the "Admin Panel" button
