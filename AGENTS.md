# Project Guidelines & Rules

## Production Verification & Code Quality Standards

> [!IMPORTANT]
> **Every code change (both Client and Server)** must pass verification before concluding work:
> 1. Run typecheck and build for the entire project:
>    ```bash
>    pnpm run build
>    ```
> 2. Ensure there are no TypeScript errors or build warnings remaining.
> 3. Maintain a clean project structure with no temporary or test scripts left in the production repository.

### Architecture & Conventions:
- **Backend**: Express on Node.js (TypeScript) compiled to `server/dist`, executed via `server/index.js`.
- **Frontend**: React (Vite + TypeScript + Tailwind CSS) compiled to `client/dist`.
- **Single-port Production**: Express backend serves the static frontend from `client/dist` in production mode.
- **Installer**: `install.sh` automated installation script for Linux servers (Debian/Ubuntu/RHEL/AlmaLinux/Rocky).
