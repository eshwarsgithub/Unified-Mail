# Deploy to Replit (100% Free - No Credit Card)

Replit provides free hosting for this project. It will go to sleep after inactivity but is perfect for testing.

## Step 1: Fork on Replit (2 minutes)

1. Go to https://replit.com
2. Sign up with GitHub (free account, no card)
3. Click **"Create Repl"**
4. Choose **"Import from GitHub"**
5. Paste: `https://github.com/eshwarsgithub/Unified-Mail`
6. Click **"Import from GitHub"**

## Step 2: Configure Environment (2 minutes)

Click on the **"Secrets"** tab (lock icon) and add:

```bash
NODE_ENV=development
PORT=3000

# Use Replit's built-in database
DATABASE_URL=postgresql://repl:password@localhost:5432/unified_mail

# Use in-memory Redis (for testing)
REDIS_URL=redis://localhost:6379

# Generate random values
JWT_SECRET=replit-test-secret-key-12345
VAULT_TOKEN=replit-vault-token

# Skip these for now (not needed for basic testing)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=unified-mail

# Skip Elasticsearch for testing
ELASTICSEARCH_NODE=http://localhost:9200

# OAuth - YOU NEED TO PROVIDE THESE
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-repl-name.repl.co/auth/gmail/callback
```

## Step 3: Get Google OAuth (5 minutes)

Follow the steps in `OAUTH_SETUP.md` to get:
- Google Client ID
- Google Client Secret

For the redirect URI, use: `https://your-repl-name.repl.co/auth/gmail/callback`

## Step 4: Create Startup Script

Create `.replit` file:
```toml
run = "cd unified-mail-platform/backend && npm install && npm run dev"
language = "nodejs"

[env]
PATH = "/home/runner/$REPL_SLUG/.config/npm/node_global/bin:/home/runner/$REPL_SLUG/node_modules/.bin"
npm_config_prefix = "/home/runner/$REPL_SLUG/.config/npm/node_global"

[nix]
channel = "stable-22_11"

[deployment]
run = ["sh", "-c", "cd unified-mail-platform/backend && npm install && npm run dev"]
```

## Step 5: Run!

Click the **"Run"** button at the top.

Your app will be live at: `https://your-repl-name.repl.co`

## Limitations of Replit (Free Tier)

- ❌ Goes to sleep after 1 hour of inactivity
- ❌ Limited CPU/memory
- ❌ No persistent file storage (database resets)
- ✅ Good for testing OAuth flow
- ✅ Good for demo purposes

## For Persistent Testing

You'll need a paid option:
- **Railway**: $5/month (includes $5 free credit)
- **Fly.io**: Free tier with card verification
- **Your own VPS**: DigitalOcean $4/month

---

## Alternative: Local Deployment Only

If you just want to test with your Gmail:

```bash
cd ~/Desktop/Unified-Mail-main/unified-mail-platform

# Setup
cd backend
cp .env.example .env
# Edit .env with your OAuth credentials

# Start infrastructure
cd ../infrastructure
docker-compose up -d

# Start backend
cd ../backend
npm install
npm run migrate
npm run dev

# Start frontend (new terminal)
cd ../frontend
npm install
npm run dev
```

Access at: http://localhost:3001

This runs entirely on your Mac - no cloud deployment needed!

---

## Need Help?

- **Can't get OAuth working?** Provide the error message
- **Want help deploying?** Share your Replit URL
- **Need a demo?** I can help set up local testing
