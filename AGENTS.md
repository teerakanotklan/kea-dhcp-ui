# Project Guidelines & Rules

## Production Verification & Code Quality Standards

> [!IMPORTANT]
> **Every code change (Shared, Client, and Server)** must pass verification before concluding work:
>
> 1. Run typecheck and build for the entire project:
>    ```bash
>    pnpm run build
>    ```
> 2. Ensure there are no TypeScript errors or build warnings remaining.
> 3. Maintain a clean project structure with no temporary or test scripts left in the production repository.

### Architecture & Workspaces Conventions:

- **Root**: Workspaces orchestration (`apps/*`, `packages/*`) via `pnpm-workspace.yaml` and `tsconfig.base.json`.
- **Packages/Shared (`@kea/shared`)**: Shared TypeScript types, interfaces, DTOs, Kea DHCP configuration structures, and Zod validation schemas compiled to `packages/shared/dist`.
- **Apps/Server (`@kea/server`)**: Express on Node.js (TypeScript) compiled to `apps/server/dist`, executed via `node apps/server/dist/index.js`.
- **Apps/Client (`@kea/client`)**: React (Vite + TypeScript + Tailwind CSS) compiled to `apps/client/dist`.
- **Single-port Production**: Express backend serves the static frontend from `apps/client/dist` in production mode.
- **Zero Relative-Path Cross-Imports**: Always import shared entities via `@kea/shared`.
- **Installer**: `install.sh` automated installation script for Linux servers (Debian/Ubuntu/RHEL/AlmaLinux/Rocky).
