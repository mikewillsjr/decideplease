# Clerk Configuration Instructions for DecidePlease

## Goal
Configure Clerk so that authentication screens say "DecidePlease" instead of "Clerk", and all branding is consistent with our app.

---

## Step-by-Step Instructions

### 1. Go to Clerk Dashboard
- URL: https://dashboard.clerk.com
- Sign in to your account
- Select the **DecidePlease** application (or create one if it doesn't exist)

---

### 2. Branding & Customization

#### Navigate to: **Customization → Branding**

Set the following:

| Setting | Value |
|---------|-------|
| **Application name** | `DecidePlease` |
| **Logo** | Upload the DecidePlease logo (hexagon icon) |
| **Favicon** | Upload a favicon version of the logo |
| **Primary color** | `#5d5dff` (our indigo/purple primary) |
| **Background color** | `#050507` (dark background) |

#### Navigate to: **Customization → Theme**

- Select **Dark mode** as default (matches our app)
- Or set to "System preference" if you want to respect user settings

---

### 3. Social Login Button Text

#### Navigate to: **User & Authentication → Social connections**

For **Google**:
1. Click on Google settings
2. Look for "Button text" or similar
3. Change from "Continue with Google" to show your app name
4. The OAuth consent screen text comes from Google Cloud Console (see below)

**IMPORTANT - Google OAuth Consent Screen:**
1. Go to https://console.cloud.google.com
2. Select your project
3. Navigate to **APIs & Services → OAuth consent screen**
4. Set **Application name** to `DecidePlease`
5. Upload the app logo
6. Set support email and developer contact
7. This is what users see when Google says "Sign in to [App Name]"

---

### 4. Email Templates

#### Navigate to: **Customization → Emails**

Update these templates to use "DecidePlease" branding:

1. **Verification email**
   - Subject: `Verify your email for DecidePlease`
   - From name: `DecidePlease`
   - Update body to mention DecidePlease, not Clerk

2. **Password reset email**
   - Subject: `Reset your DecidePlease password`
   - From name: `DecidePlease`

3. **Magic link email**
   - Subject: `Sign in to DecidePlease`
   - From name: `DecidePlease`

4. **Welcome email** (if enabled)
   - Subject: `Welcome to DecidePlease`
   - From name: `DecidePlease`

---

### 5. Sign-in/Sign-up Page Text

#### Navigate to: **Customization → Pages** (or Components)

Look for text customization options:

| Default Text | Change To |
|--------------|-----------|
| "Sign in to Clerk" | "Sign in to DecidePlease" |
| "Sign up for Clerk" | "Create your DecidePlease account" |
| "Welcome back" | "Welcome back to DecidePlease" |
| Any mention of "Clerk" | Replace with "DecidePlease" |

---

### 6. Domain & URLs

#### Navigate to: **Domains**

- Add your production domain: `decideplease.com` (or whatever it is)
- Set it as the primary domain
- This affects the URLs users see during OAuth flows

---

### 7. Session Settings

#### Navigate to: **Sessions**

Recommended settings:
| Setting | Value |
|---------|-------|
| **Session lifetime** | 7 days (or your preference) |
| **Inactivity timeout** | 24 hours |
| **Multi-session mode** | Disabled (single session per user) |

---

### 8. User Profile Settings

#### Navigate to: **User & Authentication → Email, Phone, Username**

Recommended:
- **Email address**: Required, used for identification
- **Phone number**: Optional (disabled unless you need SMS)
- **Username**: Disabled (we use email)

#### Navigate to: **User & Authentication → Personal information**

- **First name**: Optional
- **Last name**: Optional
- Keep it simple - don't require unnecessary info

---

### 9. Security Settings

#### Navigate to: **User & Authentication → Restrictions**

- **Allowlist/Blocklist**: Configure if needed
- **Sign-up mode**: Open (anyone can sign up)

#### Navigate to: **User & Authentication → Attack protection**

- Enable CAPTCHA if you want (bot protection)
- Enable rate limiting

---

### 10. API Keys (Verify These Are Set)

#### Navigate to: **API Keys**

You need these keys in your environment:

**For Frontend (Render static site):**
```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx (or pk_test_xxxxx for dev)
```

**For Backend (Render web service):**
```
CLERK_SECRET_KEY=sk_live_xxxxx (or sk_test_xxxxx for dev)
CLERK_ISSUER=https://your-app.clerk.accounts.dev
```

The CLERK_ISSUER is found in **API Keys** section, looks like:
`https://concrete-bison-XX.clerk.accounts.dev`

---

## Verification Checklist

After configuring, verify:

- [ ] Google sign-in shows "Sign in to DecidePlease" (not Clerk)
- [ ] Sign-in modal shows "DecidePlease" branding
- [ ] Emails come from "DecidePlease" not "Clerk"
- [ ] Logo appears on auth screens
- [ ] Colors match the app (dark theme, purple accent)
- [ ] No mention of "Clerk" visible to end users

---

## Quick Reference: Our Brand Colors

```
Primary (Purple/Indigo): #5d5dff
Background (Dark): #050507
Panel Background: #0e0e12
Gold Accent: #fbbf24
Green Accent: #10b981
Text Main: #ffffff
Text Muted: #9ca3af
```

---

## If Using Clerk's Hosted Pages

If you're using Clerk's hosted sign-in pages (not embedded components):

#### Navigate to: **Paths**

Set custom paths:
- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in URL: `/` (redirects to app)
- After sign-up URL: `/` (redirects to app)

---

## Notes

- Changes to OAuth consent screens (Google, etc.) may take a few minutes to propagate
- Test in an incognito window to see changes without cached sessions
- The Clerk branding removal might require a paid plan for complete white-labeling
