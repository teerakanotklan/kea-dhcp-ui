---
name: git-commit
description: >-
  Standardized Git commit workflow adhering to Conventional Commits v1.0.0.
  Use when staging files, writing commit messages, or committing changes to git.
---

# Git Commit Skill (Conventional Commits 1.0.0)

This skill provides step-by-step procedures for inspecting changes, running pre-commit checks, drafting compliant commit messages, and committing code following the **Conventional Commits v1.0.0** specification.

---

## Commit Message Format

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### 1. Types
- **`feat`**: New feature or enhancement (correlates with `MINOR` in SemVer).
- **`fix`**: Bug fix or patch (correlates with `PATCH` in SemVer).
- **`docs`**: Documentation changes only (e.g., README, code comments, API specs).
- **`style`**: Code formatting, missing semi-colons, whitespace adjustments (no logic change).
- **`refactor`**: Code refactoring that neither fixes a bug nor adds a feature.
- **`perf`**: Performance improvement.
- **`test`**: Adding missing tests or correcting existing tests.
- **`build`**: Build system or external dependencies changes (e.g., pnpm, Vite, tsconfig).
- **`ci`**: CI/CD configuration files and automation scripts (e.g., GitHub Actions).
- **`chore`**: Maintenance, repository housekeeping, or auxiliary tool updates.

### 2. Repository Scopes
When applicable, specify the affected component in parentheses:
- `client`: React UI components, Vite config, or Tailwind CSS
- `server`: Express backend, routes, controllers, or database models
- `installer`: Automated Linux deployment script (`install.sh`)
- `api`: REST API endpoints and schema
- `dhcp`: Kea DHCP configuration, control agent, or lease handlers
- `docker`: Dockerfile and `docker-compose.yml`

### 3. Description Rules
- Use the imperative mood in the present tense (e.g., `add`, `fix`, `update`, `refactor`; NOT `added`, `fixes`).
- Start with lowercase.
- Do NOT end with a period (`.`).

### 4. Breaking Changes
- Append `!` immediately before the colon in type/scope (e.g., `feat(api)!: redesign config response`).
- Or include a footer starting with `BREAKING CHANGE:` followed by a space and description.

---

## Workflow Steps

### Step 1: Inspect Changes
Check working tree status and diff:
```bash
git status --short
git diff
```

### Step 2: Run Pre-Commit Verification
Ensure project quality gates pass prior to staging:
```bash
pnpm run build
```
Verify that there are no build errors, TypeScript typecheck failures, or stray temporary files.

### Step 3: Determine Commit Elements
1. Select the primary **type** representing the change.
2. Identify the **scope** (e.g., `client`, `server`, `installer`, `api`, `dhcp`).
3. Craft a concise, imperative **description**.
4. If the change includes breaking adjustments, mark with `!` and/or `BREAKING CHANGE:`.
5. If necessary, write a multi-paragraph **body** and git trailer **footers** (e.g., `Refs: #101`, `Fixes: #42`).

### Step 4: Stage and Commit
Stage the intended files:
```bash
git add <files>
```

Execute the commit with the formatted message:
```bash
git commit -m "<type>[optional scope]: <description>"
```

For multi-line commits (with body/footer):
```bash
git commit -m "<type>[optional scope]: <description>" -m "<body paragraph>" -m "Refs: #123"
```

---

## Examples

- Feature:
  `feat(client): add dark mode toggle to navigation bar`
- Bug fix:
  `fix(server): handle socket timeout when connecting to kea control agent`
- Documentation:
  `docs: update deployment prerequisites in README`
- Refactoring:
  `refactor(server): extract subnet validation logic to helper function`
- Dependency / Build:
  `build: upgrade vite to latest version`
- Breaking Change:
  `feat(api)!: migrate config endpoints to v2 format`
