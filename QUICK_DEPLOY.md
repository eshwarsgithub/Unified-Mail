# Quick Deploy Guide - Get Live Site in 10 Minutes

This guide will get you a **fully working, live site** where you can log in with your Gmail account.

## Option 1: Railway (Recommended - Fastest)

### Step 1: Deploy Backend (3 minutes)

1. Go to https://railway.app and sign up/login
2. Click **"New Project"**
3. Click **"Deploy from GitHub repo"**
4. Select `eshwarsgithub/Unified-Mail`
5. Railway will detect the Dockerfile automatically

### Step 2: Add Databases (2 minutes)

1. Click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Click **"+ New"** → **"Database"** → **"Add Redis"**

### Step 3: Configure Environment Variables (3 minutes)

Click on your backend service → **"Variables"** tab → Add these:

```bash
# Node
NODE_ENV=production
PORT=3000

# Database (Railway will auto-populate these)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# Generate these random values
JWT_SECRET=your-random-32-char-string-here
VAULT_TOKEN=dev-vault-token-12345

# S3 (use Railway's storage or skip for now)
S3_ENDPOINT=https://storage.googleapis.com
S3_ACCESS_KEY=skip-for-now
S3_SECRET_KEY=skip-for-now
S3_BUCKET=unified-mail
S3_USE_SSL=true

# Elasticsearch (optional for now)
ELASTICSEARCH_NODE=http://localhost:9200

# OAuth - GET THESE FROM GOOGLE
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://your-app.railway.app/auth/gmail/callback

# Frontend URL
ALLOWED_ORIGINS=https://your-frontend.railway.app
```

### Step 4: Get Google OAuth Credentials (2 minutes)

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Go to **"APIs & Services"** → **"Credentials"**
4. Click **"Create Credentials"** → **"OAuth 2.0 Client ID"**
5. Choose **"Web application"**
6. Add authorized redirect URI: `https://your-app.railway.app/auth/gmail/callback`
7. Copy **Client ID** and **Client Secret**
8. Paste them in Railway environment variables

### Step 5: Deploy Frontend (2 minutes)

1. In Railway, click **"+ New"** → **"Empty Service"**
2. Name it "frontend"
3. Connect the same GitHub repo
4. Add these variables:
   ```bash
   VITE_API_URL=https://your-backend.railway.app
   ```
5. Set build command: `cd unified-mail-platform/frontend && npm install && npm run build`
6. Set start command: `cd unified-mail-platform/frontend && npx serve -s dist -p $PORT`

### Step 6: Access Your Live Site!

Railway will provide URLs like:
- **Frontend**: https://unified-mail-frontend.railway.app
- **Backend**: https://unified-mail-backend.railway.app

**You can now log in with your Gmail account!**

---

## Option 2: Render (Alternative - Free Tier Available)

### Step 1: Go to Render

1. Go to https://render.com and sign up
2. Click **"New +"** → **"Blueprint"**
3. Connect GitHub repo: `eshwarsgithub/Unified-Mail`
4. Render will detect `render.yaml` and set everything up automatically!

### Step 2: Configure OAuth

Same as Railway - get Google OAuth credentials and add to environment variables.

---

## Option 3: I'll Deploy for You

If you want me to deploy it:

1. **Create a Railway account** and give me an API token
2. **Create Google OAuth credentials** and provide:
   - Client ID
   - Client Secret
3. I'll deploy everything and give you the live URL

---

## What You'll Be Able to Do

Once deployed, you can:
- ✅ Log in with your Gmail account
- ✅ View your unified inbox
- ✅ Read emails
- ✅ Search through messages
- ✅ Organize with labels
- ✅ Reply and forward emails

---

## Costs

- **Railway**: ~$5-10/month (includes databases)
- **Render**: Free tier available (limited resources)

---

## Need Help?

Let me know if you:
1. Want me to walk you through any step
2. Get stuck on OAuth setup
3. Need help with deployment errors
4. Want me to deploy it for you (provide Railway API token)

**Estimated total time: 10-15 minutes to live site!**
