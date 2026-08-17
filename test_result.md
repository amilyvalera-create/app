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
user_problem_statement: "Phase 1 refinements for Lista de Precios VENEGE: (1) 'Descargar lista' must export the ENTIRE valid catalog for the selected channel, ignoring active search/filters. (2) Add a PDF preview screen before download/share, for BOTH the list and the quote. (3) Redesign the PDF (list & quote) to a premium white background with dark text, subtle VENEGE red accents, horizontal color logo header, repeating table headers and 'Página X de Y' footer, NO costs. (4) Reduce secondary UI text size."

backend:
  - task: "GET /api/products/export returns full catalog + RBAC (no cost leak)"
    implemented: true
    working: "NA"
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Backend export endpoint UNCHANGED. Frontend now calls it WITHOUT rin/marca so the full channel catalog is returned. Regression check only: endpoint requires auth, returns {products,count}, prices contain only role-authorized selling columns (+BF_GOODRICH), NEVER cost keys for any role incl. master."

frontend:
  - task: "Descargar lista exports full catalog + opens premium PDF preview"
    implemented: true
    working: "NA"
    file: "frontend/app/(app)/home.tsx, frontend/src/utils/listpdf.ts, frontend/src/components/PdfPreviewModal.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Download list now calls api.exportList({}) (no filters) => full channel catalog; builds premium white/red PDF HTML with color logo header; opens PdfPreviewModal (WebView/iframe) with a Compartir/Descargar button. Gerencia must pick a channel (not 'Todos'). Verified visually: header + 418 productos render."
  - task: "Cotizar generates quote and opens PDF preview"
    implemented: true
    working: "NA"
    file: "frontend/src/components/QuoteModal.tsx, frontend/src/utils/quote.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Generate quote now opens PdfPreviewModal with the redesigned premium quote PDF instead of printing directly."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1

test_plan:
  current_focus:
    - "GET /api/products/export returns full catalog + RBAC (no cost leak)"
    - "Descargar lista exports full catalog + opens premium PDF preview"
    - "Cotizar generates quote and opens PDF preview"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: "Implemented Phase 1 refinements. Backend export endpoint is UNCHANGED (regression check only). Please verify: (a) /api/products/export requires auth, returns full catalog, and NEVER leaks cost columns for any role; (b) frontend: after login (Roilan Narváez / ventasccs202601), selecting Caracas channel and tapping 'Descargar lista' opens the PDF preview modal (testID pdf-preview-modal) showing the full catalog; (c) Cotizar -> add item -> 'Generar cotización PDF' opens the preview modal. Credentials in /app/memory/test_credentials.md."
