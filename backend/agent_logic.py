from models import ChatRequest, ChatResponse
from utils import get_user_by_phone, verify_password, search_knowledge_base, create_user, update_user_password, save_message, persist_chat_session
from database import get_kuwait_time

# In-memory session store
# session_id -> { "state": "...", "data": {...} }
SESSIONS = {}

async def handle_user_message(request: ChatRequest) -> ChatResponse:
    session_id = request.session_id
    msg = request.message.strip()
    
    # [LOGGING] Save User Message
    if msg:
        # Try to get user_id from session if existing
        u_id = None
        if session_id in SESSIONS and "user" in SESSIONS[session_id]["data"]:
             u_id = SESSIONS[session_id]["data"]["user"].get("id")
        
        save_message(session_id, "user", msg, user_id=u_id)
    
    if session_id not in SESSIONS:
        SESSIONS[session_id] = {"state": "INIT", "data": {}}
        # Persist immediately as generic guest
        persist_chat_session(session_id, status="ACTIVE")
    
    session = SESSIONS[session_id]
    state = session["state"]

    if state == "ENDED":
        # Reset session
        session["state"] = "INIT"
        session["data"] = {}
        state = "INIT"
    
    # Global: Check for Human Takeover
    if ("talk" in msg.lower() and "agent" in msg.lower()) or "support" in msg.lower() or "help desk" in msg.lower():
        session["state"] = "HUMAN_TAKEOVER"
        response_text = "I've notified the help desk team. A human representative will be with you shortly."
        save_message(session_id, "ai", response_text, read_by_user=True)
        return ChatResponse(response=response_text, state="HUMAN_TAKEOVER", action="takeover", timestamp=get_kuwait_time())
    
    if state == "HUMAN_TAKEOVER":
       if "reset" in msg.lower():
           session["state"] = "INIT"
           response_text = "Resetting conversation..."
           save_message(session_id, "ai", response_text, read_by_user=True)
           return ChatResponse(response=response_text, state="INIT", timestamp=get_kuwait_time())
       
       # In takeover mode, AI does NOT reply. Backend just saves user msg (already done above)
       # We return a silent/empty response or status to tell frontend to wait
       return ChatResponse(response="", state="HUMAN_TAKEOVER", timestamp=get_kuwait_time()) 

    # --- STATE MACHINE ---

    response_text = ""
    next_state = state
    action = None

    if state == "INIT":
        next_state = "AWAIT_PHONE"
        response_text = "Welcome to the AL-TIJARIA Support Portal! 👋\n\nFor your security, could you please verify your identity by entering your registered phone number?"
    
    elif state == "AWAIT_PHONE":
        # Lenient parsing for voice/messy input: extract only digits
        clean_msg = "".join(filter(str.isdigit, msg))
        
        if not clean_msg or len(clean_msg) < 3:
            response_text = "I couldn't verify that number. Could you double-check it and try again?"
            next_state = "AWAIT_PHONE"
        else:
            user = get_user_by_phone(clean_msg)
            if user:
                session["data"]["user"] = {
                    "email": user.email, 
                    "password": user.password,
                    "name": user.full_name,
                    "phone": user.phone
                }
                next_state = "AWAIT_EMAIL"
                response_text = "Great, I've found your profile. Could you confirm your email address for me?"
            else:
                session["data"]["reg_phone"] = msg
                next_state = "REG_AWAIT_NAME"
                response_text = "Number not recognized.\n\nInitiating Account Creation Protocol.\n\nPlease enter your Full Name:"

    # --- LOGIN FLOW ---
    elif state == "AWAIT_EMAIL":
        session["data"]["input_email"] = msg
        next_state = "AWAIT_PASSWORD"
        response_text = "Thanks! Now, please enter your password to log in."

    elif state == "AWAIT_PASSWORD":
        password_input = msg.strip()
        email = session["data"]["user"]["email"]
        
        # Use centralized verification
        if verify_password(email, password_input):
             # Refresh user data from DB to ensure we have latest
             user = get_user_by_phone(session["data"]["user"]["phone"])
             if user:
                 session["data"]["user"]["id"] = user.id
                 session["data"]["user"]["name"] = user.full_name
                 session["data"]["user"]["phone"] = user.phone
                 session["data"]["user"]["department"] = user.department
                 
                 next_state = "AUTHENTICATED"
                 response_text = f"✅ Access Granted. Welcome back, {user.full_name}. How can I help you?"
                 action = "login_success"
                 
                 # Persist Login
                 persist_chat_session(session_id, user_id=user.id, guest_name=user.full_name, guest_dept=user.department)
             else:
                 response_text = "❌ Error: User profile mismatch. Please contact support."
                 next_state = "INIT"
        else:
             response_text = "❌ That password doesn't look right. Please try again."
             next_state = "AWAIT_PASSWORD"

    # --- CHANGE PASSWORD FLOW ---
    elif state == "AUTHENTICATED" and "change password" in msg.lower():
        next_state = "CHANGE_PASS_OLD"
        response_text = "Security Request Initiated: Change Password.\n\nPlease enter your CURRENT password."

    elif state == "CHANGE_PASS_OLD":
        current_password = session["data"]["user"]["password"]
        if msg == current_password:
            next_state = "CHANGE_PASS_NEW"
            response_text = "Verified. Please enter your NEW password."
        else:
            response_text = "❌ Incorrect current password. Request cancelled."
            next_state = "AUTHENTICATED"

    elif state == "CHANGE_PASS_NEW":
        session["data"]["new_password"] = msg
        next_state = "CHANGE_PASS_CONFIRM"
        response_text = "Please re-type to CONFIRM your new password."

    elif state == "CHANGE_PASS_CONFIRM":
        new_pass = session["data"]["new_password"]
        if msg == new_pass:
            # Update DB
            phone = session["data"]["user"]["phone"]
            if update_user_password(phone, new_pass):
                session["data"]["user"]["password"] = new_pass
                next_state = "AUTHENTICATED"
                response_text = "✅ Password successfully updated."
            else:
                next_state = "AUTHENTICATED"
                response_text = "❌ System Error: Could not update password."
        else:
             response_text = "❌ Passwords do not match. Please enter your NEW password again."
             next_state = "CHANGE_PASS_NEW"

    # --- REGISTRATION FLOW ---
    elif state == "REG_AWAIT_NAME":
        session["data"]["reg_name"] = msg
        persist_chat_session(session_id, guest_name=msg) # Save simplified name early
        next_state = "REG_AWAIT_EMAIL"
        response_text = f"Acknowledged. Please provide a valid email address."

    elif state == "REG_AWAIT_EMAIL":
        if "@" not in msg:
             response_text = "Invalid format. Please enter a valid email address."
             next_state = "REG_AWAIT_EMAIL"
        else:
             session["data"]["reg_email"] = msg
             next_state = "REG_AWAIT_PASSWORD"
             response_text = "Set a secure password."

    elif state == "REG_AWAIT_PASSWORD":
        session["data"]["reg_password"] = msg
        next_state = "REG_AWAIT_DEPT"
        response_text = "Department affiliation?"

    elif state == "REG_AWAIT_DEPT":
        session["data"]["reg_dept"] = msg
        
        new_user = create_user(
            phone=session["data"]["reg_phone"],
            email=session["data"]["reg_email"],
            name=session["data"]["reg_name"],
            password=session["data"]["reg_password"],
            dept=session["data"]["reg_dept"]
        )

        if new_user:
            next_state = "AUTHENTICATED"
            session["data"]["user"] = {
                "email": new_user.email,
                "password": new_user.password,
                "name": new_user.full_name,
                "phone": new_user.phone,
                "department": new_user.department
            }
            # Persist Full Registration
            persist_chat_session(session_id, user_id=new_user.id, guest_name=new_user.full_name, guest_dept=new_user.department)

            response_text = f"Account Created Successfully.\n\nWelcome, {new_user.full_name}."
            action = "login_success"
        else:
            next_state = "INIT"
            response_text = "❌ Creation Error. Account may already exist."

    # --- AUTHENTICATED Q&A ---
    elif state == "AUTHENTICATED":
        answer = search_knowledge_base(msg)
        if answer:
            response_text = answer
            next_state = "AUTHENTICATED"
        else:
            response_text = "I searched our knowledge base but couldn't find an exact match. would you like to open a support ticket instead?"
            next_state = "AUTHENTICATED"
    
    else:
        response_text = "System Error: Unknown state."
        next_state = "ERROR"

    # Update Session & Log Response
    session["state"] = next_state
    if response_text:
        save_message(session_id, "ai", response_text, read_by_user=True)
        
    return ChatResponse(response=response_text, state=next_state, action=action, timestamp=get_kuwait_time())

def get_all_sessions():
    """Returns the in-memory SESSIONS dictionary."""
    return SESSIONS

def end_session(session_id: str):
    """Ends a session by setting its state to ENDED in memory and DB."""
    session_id = session_id.strip()
    in_memory = False
    if session_id in SESSIONS:
        SESSIONS[session_id]["state"] = "ENDED"
        in_memory = True
    
    # Always persist to DB to ensure it's removed from live view
    try:
        persist_chat_session(session_id, status="ENDED")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to persist ENDED status for {session_id}: {e}")
        return in_memory # Return True if at least memory was updated
