#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Restore Couling app from GitHub branch conflict_180526_1519, merge into main, keep all Couling functionality (auth, chat, call, meeting, test_couling.py), fix merge conflicts, run end-to-end."

backend:
  - task: "Couling FastAPI backend (auth OTP, contacts, chats, calls, meetings)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Merged from conflict_180526_1519. Backend online at /api. pytest tests/test_couling.py = 21 passed; tests/test_message_management.py = 13 passed, 1 skipped. NOTE: this FastAPI backend is legacy and NOT wired to the current UI (UI uses Supabase)."

frontend:
  - task: "Couling Expo (React Native Web) app boots and splash renders"
    implemented: true
    working: true
    file: "app/index.tsx, public/index.html"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Fixed RNW root height collapse (added height reset to public/index.html) and a hanging supabase.auth.getSession() gate (added Promise.race 2s timeout). Splash '/' renders fully with hero art + gold 'Enter the Circle' button."
  - task: "Navigate to /auth/email and complete Supabase email signup -> profile -> chats"
    implemented: true
    working: "NA"
    file: "app/auth/email.tsx, app/_layout.tsx, app/auth/profile.tsx, src/api/supa.ts"
    stuck_count: 1
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "When clicking 'Enter the Circle' (get-started-btn) or deep-linking /auth/email, the route shows a spinner then blank; email-input never appears. No JS console error observed. Tried: set experiments.asyncRoutes=false in app.json, set Stack animation to 'none'. Could not confirm fix via screenshot tool (it does not surface logs/injected overlays). Needs testing agent with console+network capture to pinpoint whether a lazy chunk/request hangs or the screen renders with zero height."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: true

test_plan:
  current_focus:
    - "Navigate to /auth/email and complete Supabase email signup -> profile -> chats"
  stuck_tasks:
    - "Navigate to /auth/email and complete Supabase email signup -> profile -> chats"
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "This is an Expo React Native Web app (runs via expo start --web on port 3000) with a Supabase backend (keys in frontend/.env; DB tables already exist). Splash renders. The blocker is navigating past the splash to the email auth screen — it hangs on a spinner/blank with NO visible JS error. Please open the preview URL, wait for the splash (gold 'Enter the Circle'), click data-testid=get-started-btn, and report EXACTLY what happens on /auth/email with full browser console AND network logs (look for any pending/failed request or chunk). Then, if it renders, complete signup via data-testid email-input/password-input/signup-btn (toggle-auth-mode-btn to switch to signup), set profile name, and verify the (tabs) chats screen loads. Phone/SMS OTP is intentionally 'coming soon' - use EMAIL."

#====================================================================================================
# Old Testing Data
#====================================================================================================