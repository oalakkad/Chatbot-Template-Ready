/**
 * WHITE-LABEL CHATBOT - BRANDING CONFIGURATION
 * 
 * This file centralizes ALL branding elements for easy client customization.
 * Simply update the values below to rebrand the entire chatbot for a new client.
 * 
 * NO CODE CHANGES NEEDED - just edit this file!
 */

module.exports = {
    // ========================================
    // COMPANY INFORMATION
    // ========================================
    company: {
        name: "YourCompany",
        tagline: "Intelligent Support, Instant Answers",
        supportEmail: "support@yourcompany.com",
        supportPhone: "+965 XXXX XXXX",
        website: "https://www.yourcompany.com"
    },

    // ========================================
    // BRANDING & ASSETS
    // ========================================
    branding: {
        // Logo paths (relative to public folder)
        logoMain: "/logo.jpg",              // Main company logo
        logoFavicon: "/favicon.ico",        // Browser favicon
        chatAvatar: "/logo.jpg",            // Chat widget avatar

        // Company icon/emoji for notifications
        icon: "🏢"
    },

    // ========================================
    // COLOR SCHEME
    // ========================================
    colors: {
        // Primary brand color (main CTA buttons, links)
        primary: "#0ea5e9",       // Sky blue
        primaryHover: "#0284c7",  // Darker on hover

        // Secondary/accent colors
        secondary: "#3b82f6",     // Blue
        accent: "#8b5cf6",        // Purple

        // Agent/human takeover colors
        agentPrimary: "#7c3aed",  // Purple (when human agent active)
        agentSecondary: "#6366f1", // Indigo

        // Background colors
        bgLight: "#f8fafc",       // Light background
        bgDark: "#0f172a",        // Dark background
        bgCard: "#1e293b",        // Card background

        // Text colors
        textPrimary: "#1e293b",   // Main text
        textSecondary: "#64748b", // Secondary text
        textLight: "#94a3b8",     // Light text

        // Status colors
        success: "#10b981",       // Green
        warning: "#f59e0b",       // Amber
        error: "#ef4444",         // Red
        info: "#06b6d4"           // Cyan
    },

    // ========================================
    // UI TEXT & MESSAGES
    // ========================================
    text: {
        // Chat widget header
        chatTitle: "Help Desk AI",
        chatSubtitle: "Online",
        chatSubtitleAgent: "Connected to Human",

        // Welcome & greeting messages
        welcomeMessage: "Welcome! 👋 How can we help you today?",

        // Input placeholders
        inputPlaceholder: "Type your message...",
        inputPlaceholderAgent: "Chatting with support agent...",

        // Quick action buttons
        quickActions: [
            "General Questions",
            "Talk to Help Desk"
        ],

        // Loading states
        loadingThinking: "Thinking...",
        loadingSearching: "Searching Knowledge Base...",

        // Error messages
        errorGeneric: "Something went wrong. Please try again.",
        errorNetwork: "Connection error. Please check your internet.",
        errorVoice: "Could not access microphone. Please check permissions.",

        // Session messages
        sessionEnded: "Session ended by agent. Starting new chat...",
        sessionEndedByUser: "You have ended the chat.",

        // Agent takeover
        agentConnecting: "I've notified the help desk team. A human representative will be with you shortly.",
        agentConnected: "You're now connected to {agentName}",

        // Modal texts
        endChatTitle: "End Conversation?",
        endChatMessage: "Are you sure you want to end this chat? This will clear your chat history.",
        endChatConfirm: "Yes, End Chat",
        endChatCancel: "Cancel"
    },

    // ========================================
    // FEATURE FLAGS
    // ========================================
    features: {
        voiceEnabled: true,          // Enable voice input/output
        callingEnabled: true,        // Enable voice calling feature
        fileUploadEnabled: true,     // Enable file uploads
        knowledgeBaseEnabled: true,  // Enable RAG/knowledge base
        agentHandoffEnabled: true,   // Enable human agent takeover
        typingIndicator: true,       // Show typing indicator
        readReceipts: true,          // Show read receipts
        timestamps: true             // Show message timestamps
    },

    // ========================================
    // AUTHENTICATION & REGISTRATION
    // ========================================
    auth: {
        requiresAuth: true,           // Require login before chat
        allowRegistration: true,      // Allow new user registration

        // Registration fields
        registrationFields: {
            requirePhone: true,
            requireEmail: true,
            requireDepartment: true,
            requireName: true
        },

        // Welcome messages
        welcomeMessageAuth: "Welcome to the Enterprise Support Portal! 👋\n\nFor your security, could you please verify your identity by entering your registered phone number?",
        registrationWelcome: "Number not recognized.\n\nInitiating Account Creation Protocol.\n\nPlease enter your Full Name:"
    },

    // ========================================
    // ADMIN PORTAL
    // ========================================
    admin: {
        title: "Admin Portal",
        dashboardTitle: "Customer Support Dashboard",

        // Sidebar navigation
        nav: {
            dashboard: "Live Sessions",
            knowledge: "Knowledge Base",
            users: "User Management",
            settings: "Settings"
        }
    },

    // ========================================
    // TECHNICAL SETTINGS
    // ========================================
    technical: {
        // API endpoints (override in .env)
        apiBaseUrl: "http://127.0.0.1:8000",

        // Polling intervals (milliseconds)
        pollingInterval: 3000,        // Check for new messages every 3s

        // Chat behavior
        maxMessageLength: 2000,
        typingSpeed: 15,              // Characters per "tick" for typewriter effect

        // Voice settings
        voiceLanguage: "en-US",       // Speech recognition language
        voiceContinuous: true,        // Continuous recognition
        voiceInterimResults: true     // Show interim results
    }
};
