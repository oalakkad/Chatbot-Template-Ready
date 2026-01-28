# White-Label Chatbot Template

A fully-featured, customizable AI chatbot with admin portal, authentication, and human agent handoff capabilities. Perfect for selling to different clients with minimal customization effort.

## 🎨 Features

- **🤖 Intelligent AI Agent** - Powered by Claude with OpenAI fallback
- **📚 Knowledge Base (RAG)** - Upload PDFs for context-aware responses
- **👤 User Authentication** - Login, registration, and session management
- **🎧 Human Agent Handoff** - Seamless transfer to live support agents
- **📊 Admin Portal** - Monitor chats, manage users, update knowledge base
- **🎙️ Voice Support** - Browser-native voice input (zero-cost)
- **🎨 Fully Brandable** - One configuration file to rebrand entire system

## 🚀 Quick Start

### 1. Installation

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### 2. Configuration

#### Branding Setup
Edit `branding.config.js` in the root directory:

```javascript
company: {
  name: "YourCompany",
  supportEmail: "support@yourcompany.com"
},
colors: {
  primary: "#0ea5e9",    // Your brand color
  secondary: "#3b82f6"
}
```

#### Environment Variables
Copy `.env.template` to `.env` and add your API keys:

```bash
cp .env.template .env
# Edit .env with your credentials
```

### 3. Database Setup

```bash
# Create MySQL database
mysql -u root -p
CREATE DATABASE chatbot_db;

# Run migrations (backend will auto-create tables)
python backend/main.py
```

### 4. Run the Application

```bash
# Terminal 1: Backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

Visit: http://localhost:3000

## 🎨 Customization Guide

### Branding

All branding is controlled via `branding.config.js`:

| Element | Config Key | Example |
|---------|-----------|---------|
| Company Name | `company.name` | "Acme Corp" |
| Primary Color | `colors.primary` | "#FF6B6B" |
| Logo | `branding.logoMain` | "/logo.png" |
| Chat Title | `text.chatTitle` | "Acme Support" |

### Adding Client Logo

1. Place logo in `frontend/public/`
2. Update `branding.config.js`:
   ```javascript
   branding: {
     logoMain: "/client-logo.png"
   }
   ```

### Custom Colors

Use your client's brand colors in `branding.config.js`:

```javascript
colors: {
  primary: "#1E40AF",      // Brand blue
  secondary: "#DC2626",    // Brand red
  agentPrimary: "#7C3AED"  // Purple for agent mode
}
```

## 🔧 API Keys Required

| Service | Purpose | Get Key From |
|---------|---------|--------------|
| **Pinecone** | Vector database (knowledge base) | [pinecone.io](https://pinecone.io) |
| **Anthropic** | Primary AI (Claude) | [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI** | Fallback AI (GPT-4) | [platform.openai.com](https://platform.openai.com) |

## 📁 Project Structure

```
Chatbot Template/
├── branding.config.js          # 🎨 MAIN BRANDING FILE
├── .env.template               # Environment variable template
├── backend/
│   ├── main.py                 # FastAPI backend
│   ├── agent_logic.py          # AI conversation logic
│   ├── knowledge_base.py       # RAG implementation
│   ├── models.py               # Data models
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWidget.tsx  #Main chat interface
│   │   │   ├── ChatInput.tsx   # Voice + text input
│   │   │   └── ChatMessage.tsx
│   │   └── app/
│   │       ├── admin/          # Admin portal
│   │       └── page.tsx
│   └── package.json
└── README.md
```

## 🛠️ Admin Portal

Access at: `http://localhost:3000/admin`

**Default Login:**
- Email: Create admin user via `/admin/users` endpoint
- Or check `backend/models_db.py` for seeded users

**Features:**
- 📊 Live chat monitoring
- 💬 Manual agent takeover
- 📂 Knowledge base management
- 👥 User management
- 🔚 End sessions

## 📝 Deployment

### Production Checklist

- [ ] Update `branding.config.js` with client details
- [ ] Set `.env` with production API keys
- [ ] Update `NEXT_PUBLIC_API_URL` to production backend
- [ ] Set `NODE_ENV=production`
- [ ] Configure MySQL database
- [ ] Set up Pinecone index
- [ ] Upload client knowledge base PDFs
- [ ] Test all features
- [ ] Create admin user

### Deployment Options

**Backend:**
- Railway, Render, AWS, DigitalOcean
- Requires Python 3.10+

**Frontend:**
- Vercel (recommended for Next.js)
- Netlify, AWS Amplify

**Database:**
- PlanetScale, AWS RDS, DigitalOcean MySQL

## 🎯 Selling to Clients

### Customization Time: ~15 minutes

1. **5 min** - Update `branding.config.js`
2. **5 min** - Add client logo and set colors
3. **5 min** - Configure `.env` with their API keys

### Pricing Tiers

**Suggested Model:**
- Setup Fee: $500-1000 (one-time)
- Monthly: $99-299/month (based on usage)
- API costs passed to client or included

## 🆘 Support

For issues or questions:
1. Check `branding.config.js` - most customizations are there
2. Review `.env.template` for missing env vars
3. Ensure all API keys are valid

## 📜 License

Proprietary - Not for redistribution

---

**Need help customizing for a client?** All settings are in one place: `branding.config.js` 🎨
