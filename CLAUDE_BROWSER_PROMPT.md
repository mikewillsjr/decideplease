# Copy this entire prompt to Claude in browser with computer use:

---

I need you to configure my Clerk authentication dashboard for my app called "DecidePlease". Please go through each setting and update it so users see "DecidePlease" branding instead of "Clerk" branding.

## Login to Clerk Dashboard
1. Go to https://dashboard.clerk.com
2. Sign in if needed
3. Select the DecidePlease application

## Tasks to Complete

### Task 1: Application Branding
Go to **Customization → Branding** and set:
- Application name: `DecidePlease`
- Primary color: `#5d5dff`
- If there's a logo upload, let me know and I'll provide one
- Enable dark mode if available

### Task 2: Fix OAuth Text
The main issue is when users click "Sign in with Google", it says "Sign in to Clerk" instead of "Sign in to DecidePlease".

Go to **User & Authentication → Social connections → Google** and:
- Look for any text/label customization
- Change any instance of "Clerk" to "DecidePlease"

If the Google OAuth text comes from Google Cloud Console:
- Go to https://console.cloud.google.com
- Find the OAuth consent screen settings
- Change the application name to "DecidePlease"

### Task 3: Email Templates
Go to **Customization → Emails** and update ALL email templates:
- Change "From name" to: `DecidePlease`
- Change subject lines to mention "DecidePlease" not "Clerk"
- Update email body text to say "DecidePlease"

Templates to update:
- Verification email
- Password reset
- Magic link
- Welcome email
- Any other templates

### Task 4: Sign-in/Sign-up Page Text
Go to **Customization** and look for any text/copy customization:
- Change "Sign in to Clerk" → "Sign in to DecidePlease"
- Change "Sign up for Clerk" → "Create your DecidePlease account"
- Remove any mention of "Clerk" from user-facing text

### Task 5: Verify Settings
Check these are configured correctly:
- **Sessions**: Session lifetime of 7 days is fine
- **User settings**: Email required, phone optional/disabled, username disabled

### Task 6: Get the API Keys
Go to **API Keys** and tell me:
1. The Publishable Key (starts with `pk_`)
2. The Secret Key (starts with `sk_`)
3. The Issuer URL (looks like `https://something.clerk.accounts.dev`)

## Brand Colors Reference
- Primary Purple: `#5d5dff`
- Dark Background: `#050507`
- Gold Accent: `#fbbf24`
- Green: `#10b981`
- White text: `#ffffff`
- Muted text: `#9ca3af`

## After You're Done
Please summarize:
1. What changes you made
2. Any settings you couldn't find or change
3. The API keys I need to set in my environment

The goal is that NO user should ever see the word "Clerk" - everything should say "DecidePlease".
