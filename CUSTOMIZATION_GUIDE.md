# Client Customization Guide

This guide will help you rebrand the chatbot for your client in **under 15 minutes**.

## Quick Setup (3 Steps)

### Step 1: Branding (5 minutes)

Edit `branding.config.js` in the root folder:

```javascript
// 1. Company Information
company: {
  name: "Client Company Name",           // e.g., "Acme Corp"
  tagline: "Your Support Tagline",       // e.g., "24/7 Customer Support"
  supportEmail: "support@clientdomain.com",
  supportPhone: "+1 XXX-XXX-XXXX",
  website: "https://www.clientdomain.com"
},

// 2. Update Colors
colors: {
  primary: "#HEX_COLOR",                 // Client's brand color
  secondary: "#HEX_COLOR",               // Secondary brand color
  // ... other colors will auto-adjust
},

// 3. Update Chat Text
text: {
  chatTitle: "Client Support",           // Widget header
  welcomeMessage: "Welcome to Client! How can we help?",
},
```

### Step 2: Logo & Assets (3 minutes)

1. **Add client logo:**
   - Place `logo.png` in `frontend/public/`
   - Update `branding.config.js`:
     ```javascript
     branding: {
       logoMain: "/logo.png",
       chatAvatar: "/logo.png"
     }
     ```

2. **Add favicon:**
   - Place `favicon.ico` in `frontend/public/`

### Step 3: API Keys (7 minutes)

1. Copy `.env.template` to `.env`:
   ```bash
   cp .env.template .env
   ```

2. Add client's API keys in `.env`:
   ```bash
   # Required
   PINECONE_API_KEY=pc-xxxxx
   PINECONE_INDEX_NAME=client-chatbot
   PINECONE_HOST=https://xxxxx.svc.region.pinecone.io
   
   ANTHROPIC_API_KEY=sk-ant-xxxxx
   OPENAI_API_KEY=sk-proj-xxxxx
   
   # Database
   DATABASE_URL=mysql+pymysql://user:pass@host:3306/client_db
   
   # Company
   COMPANY_NAME=Client Company Name
   ```

## Advanced Customization

### Custom Welcome Flow

Edit `backend/agent_logic.py`:

```python
# Line ~62
if state == "INIT":
    next_state = "AWAIT_PHONE"
    response_text = "Your custom welcome message here"
```

### Custom Quick Actions

Edit `branding.config.js`:

```javascript
text: {
  quickActions: [
    "Product Information",
    "Schedule Demo",
    "Talk to Sales"
  ]
}
```

### Knowledge Base

1. Collect client's support documents (PDF format)
2. Log in to admin portal: `http://localhost:3000/admin`
3. Navigate to **Knowledge Base** tab
4. Upload PDFs

## Color Palette Examples

### Professional Blue
```javascript
colors: {
  primary: "#2563eb",
  secondary: "#1e40af",
  agentPrimary: "#7c3aed"
}
```

### Modern Green
```javascript
colors: {
  primary: "#10b981",
  secondary: "#059669",
  agentPrimary: "#8b5cf6"
}
```

### Corporate Red
```javascript
colors: {
  primary: "#dc2626",
  secondary: "#991b1b",
  agentPrimary: "#7c3aed"
}
```

## Testing Checklist

After customization, test:

- [ ] Logo displays correctly
- [ ] Colors match client brand
- [ ] Welcome message is accurate
- [ ] Company name appears in chat
- [ ] Knowledge base returns relevant answers
- [ ] Human handoff works
- [ ] Admin portal accessible

## Deployment

### Quick Deploy (Vercel + Railway)

**Frontend** (Vercel):
```bash
cd frontend
vercel --prod
```

**Backend** (Railway):
```bash
cd backend
railway up
```

Update frontend `.env`:
```
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

## Common Issues

### Logo not showing
- Ensure file is in `frontend/public/`
- Check spelling in `branding.config.js`
- Clear browser cache

### Colors not updating
- Restart frontend dev server: `npm run dev`
- Clear `.next` folder: `rm -rf .next`

### API errors
- Verify all API keys in `.env`
- Check Pinecone index name matches
- Ensure database is running

## Client Handoff

When delivering to client, provide:

1. **Access Credentials:**
   - Admin portal URL
   - Default admin login
   - Database credentials

2. **API Keys Needed:**
   - Pinecone (for knowledge base)
   - Anthropic (for AI)
   - OpenAI (fallback)

3. **Documentation:**
   - This customization guide
   - Main README.md
   - Knowledge base upload guide

4. **Support Contact:**
   - Your support email
   - Emergency contact

---

**Need Help?** All customization is in `branding.config.js` - one file to rule them all! 🎨
