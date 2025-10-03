# OAuth Setup Guide - Gmail Integration

This guide shows you how to get OAuth credentials to allow users to log in with Gmail.

## Step-by-Step: Google OAuth Setup

### 1. Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### 2. Create a New Project (if needed)
- Click the project dropdown at the top
- Click **"New Project"**
- Name it: `Unified Mail Platform`
- Click **"Create"**

### 3. Enable Gmail API
- Go to **"APIs & Services"** → **"Library"**
- Search for **"Gmail API"**
- Click on it and click **"Enable"**

### 4. Configure OAuth Consent Screen
- Go to **"APIs & Services"** → **"OAuth consent screen"**
- Choose **"External"** (unless you have Google Workspace)
- Fill in:
  - **App name**: Unified Mail Platform
  - **User support email**: your-email@gmail.com
  - **Developer contact**: your-email@gmail.com
- Click **"Save and Continue"**

### 5. Add Scopes
- Click **"Add or Remove Scopes"**
- Add these Gmail scopes:
  ```
  https://www.googleapis.com/auth/gmail.readonly
  https://www.googleapis.com/auth/gmail.send
  https://www.googleapis.com/auth/gmail.modify
  https://www.googleapis.com/auth/userinfo.email
  https://www.googleapis.com/auth/userinfo.profile
  ```
- Click **"Save and Continue"**

### 6. Add Test Users (for development)
- Add your Gmail address as a test user
- Click **"Save and Continue"**

### 7. Create OAuth Client ID
- Go to **"APIs & Services"** → **"Credentials"**
- Click **"+ Create Credentials"** → **"OAuth 2.0 Client ID"**
- Choose **"Web application"**
- Name it: `Unified Mail Web Client`

### 8. Add Authorized Redirect URIs

Add these URIs (replace with your actual URLs):

**For Local Testing:**
```
http://localhost:3000/auth/gmail/callback
http://localhost:3001/auth/callback
```

**For Production (Railway/Render):**
```
https://your-backend.railway.app/auth/gmail/callback
https://your-frontend.railway.app/auth/callback
```

### 9. Get Your Credentials

After clicking **"Create"**, you'll see:
- **Client ID**: Something like `123456789-abc123.apps.googleusercontent.com`
- **Client Secret**: Something like `GOCSPX-xyz789abc456`

**Copy these values!** You'll need them for deployment.

---

## Adding Credentials to Your Deployment

### For Railway:
1. Go to your backend service
2. Click **"Variables"** tab
3. Add:
   ```
   GOOGLE_CLIENT_ID=your-client-id-here
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   GOOGLE_REDIRECT_URI=https://your-backend.railway.app/auth/gmail/callback
   ```

### For Render:
1. Go to your backend service
2. Click **"Environment"** tab
3. Add the same variables

### For Local Testing:
Edit `backend/.env`:
```bash
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/gmail/callback
```

---

## Testing OAuth Flow

### 1. Start Your Application
- Frontend should be running
- Backend should be running

### 2. Click "Login with Gmail"
- You'll be redirected to Google
- Sign in with your Gmail account
- Grant permissions

### 3. You'll Be Redirected Back
- With an access token
- Your emails will start syncing!

---

## Troubleshooting

### "Error 400: redirect_uri_mismatch"
- Check that your redirect URI in Google Console **exactly matches** the one in your `.env`
- Include http/https, domain, and path
- No trailing slashes

### "Access blocked: This app's request is invalid"
- Make sure you've added your email as a test user in OAuth consent screen
- Or publish your app (requires verification for production)

### "Invalid client"
- Double-check your Client ID and Client Secret
- Make sure there are no extra spaces

---

## Security Notes

### For Development:
- Keep your app in "Testing" mode
- Only test users can log in

### For Production:
- You'll need to verify your app with Google
- This requires domain verification
- Takes 1-2 weeks

### Keep Secrets Safe:
- Never commit `.env` to Git
- Use environment variables in production
- Rotate secrets if exposed

---

## What Scopes Allow

The scopes we're requesting allow the app to:

- ✅ **gmail.readonly**: Read your emails
- ✅ **gmail.send**: Send emails on your behalf
- ✅ **gmail.modify**: Organize (labels, archive, etc.)
- ✅ **userinfo.email**: Get your email address
- ✅ **userinfo.profile**: Get your name and profile picture

---

## Ready to Deploy?

Once you have your OAuth credentials:
1. Follow the deployment guide in `QUICK_DEPLOY.md`
2. Add your credentials as environment variables
3. Access your live site!

**You'll be able to log in with Gmail and see your inbox within minutes!**
