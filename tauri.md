You are a senior full-stack engineer with deep expertise in:
- Tauri (latest stable)
- Rust (Tauri core only, minimal Rust)
- React 18
- Vite
- Tailwind CSS
- Zustand
- Go 1.21+ (Gin/Echo)
- .NET 8 (EF Core, Hangfire)
- PostgreSQL 17
- Redis 7

TASK:
Integrate Tauri into an EXISTING React 18 + Vite + Tailwind + Zustand project
to turn it into a cross-platform DESKTOP APPLICATION.

CONTEXT:
- Frontend: React 18 + Vite + Tailwind + Zustand
- Backend: Go (Gin/Echo) and/or .NET 8 (EF Core + Hangfire)
- Backend communicates via HTTP/JSON (and optionally WebSocket)
- PostgreSQL 17 + Redis 7 remain SERVER-SIDE
- Desktop app is a UI shell + optional local backend sidecar

GOALS:
1. Add Tauri with minimal changes to the existing frontend
2. Configure dev + prod builds correctly
3. Ensure secure API communication with backend
4. Support environment-based API URLs
5. Produce working desktop builds for:
   - Windows
   - macOS
   - Linux

REQUIREMENTS:
- Use Vite (NOT CRA)
- Use the latest Tauri v2 syntax if applicable
- Use best practices for security (CSP, allowlist)
- Avoid unnecessary Rust complexity
- Provide copy-paste-ready code and configs

DELIVERABLES (MUST INCLUDE):
1. Step-by-step installation instructions
2. Exact CLI commands
3. Updated `package.json` scripts
4. `vite.config.ts` adjustments
5. `tauri.conf.json` (secure but dev-friendly)
6. Example `.env` usage for API URLs
7. Example API client setup in React
8. Explanation of CORS handling for:
   - Go (Gin/Echo)
   - .NET 8
9. Build and release commands
10. Folder structure overview

OPTIONAL (IF RELEVANT):
- How to launch a Go or .NET backend as a Tauri sidecar
- Auto-update configuration
- System tray integration
- Secure storage for auth tokens

CONSTRAINTS:
- Do NOT suggest Electron
- Do NOT redesign the frontend
- Do NOT introduce server-side rendering
- Keep explanations concise but precise

OUTPUT FORMAT:
- Clear sections
- Code blocks only where needed
- No filler or marketing language
- Assume the reader is an experienced developer

BEGIN.
