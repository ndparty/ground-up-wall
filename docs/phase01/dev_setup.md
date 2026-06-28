# Dev Setup Guide — ground-up-wall

> **Purpose:** Prepare a developer's local machine with the tools and runtimes needed to contribute
> to the `ground-up-wall` project.
>
> **Applies to:** Windows 11, Ubuntu 26.04, macOS Tahoe 26.5.1
>
> **No Docker.** This guide covers bare-metal native installation only.
>
> **When to use this guide:** Before starting any code execution plan. After completing this guide,
> a developer should be able to clone the repository and run `deno task start` /
> `deno run -A scripts/migrate.ts` without missing dependencies.

---

## Table of Contents

1. [Prerequisites (Quick Reference)](#1-prerequisites-quick-reference)
2. [Quick Start (TL;DR)](#2-quick-start-tldr)
3. [macOS (Tahoe 26.5.1)](#3-macos-tahoe-2651)
4. [Linux (Ubuntu 26.04)](#4-linux-ubuntu-2604)
5. [Windows 11](#5-windows-11)
6. [Post-Installation Verification](#6-post-installation-verification)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites (Quick Reference)

| Requirement               | Version       | Purpose                                                      |
| ------------------------- | ------------- | ------------------------------------------------------------ |
| **Deno**                  | latest stable | Runtime, TypeScript compiler, test runner, linter, formatter |
| **PostgreSQL**            | 17+           | Relational database                                          |
| **Git**                   | any modern    | Version control                                              |
| **VS Code** (recommended) | latest        | Code editor                                                  |

> **Note:** Node.js / npm are **not** required. Deno bundles its own runtime, package management,
> and toolchain.

---

## 2. Quick Start (TL;DR)

The fastest path to a ready development machine:

```
┌──────────────────────────────────────────────────────┐
│ 1. Install Deno                 (runtime)            │
│ 2. Install PostgreSQL 17+       (database)           │
│ 3. Create databases             (dev + test)         │
│ 4. Copy .env.example → .env     (config)             │
│ 5. Install Git                  (version control)    │
│ 6. Install VS Code + Deno ext   (editor)             │
└──────────────────────────────────────────────────────┘
```

After tools are installed, bootstrap the application (from the repo root):

```bash
createdb ground_up_wall_dev
createdb ground_up_wall_test
cp .env.example .env
deno install --lock=deno.lock
deno task db:migrate
deno task db:seed
deno task start
```

Open http://localhost:8080. Full demo walkthrough: **[../../DEMO.md](../../DEMO.md)**. Developer
details: **[../../SETUP.md](../../SETUP.md)**.

OS-specific install instructions for each step are below.

> **Version compatibility:** The project (`WI-01`) pins the following dependencies in `deno.json`
> (all via JSR, exact versions defined in the
> [WI-01 Code Execution Plan](./code_execution_plan-wi-01.md)):
>
> | Package                                                                                                                                                                    | Version    | Purpose                                                      |
> | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------ |
> | [`@fresh/core`](https://jsr.io/@fresh/core)                                                                                                                                | `^2.3.3`   | Deno Fresh framework (matches Deno Deploy runtime ~Deno 2.5) |
> | [`preact`](https://jsr.io/preact)                                                                                                                                          | `^10.29.2` | UI library                                                   |
> | [`@preact/render-to-string`](https://jsr.io/@preact/render-to-string)                                                                                                      | `^6.6.7`   | SSR rendering                                                |
> | [`@preact/signals`](https://jsr.io/@preact/signals)                                                                                                                        | `^1.3.0`   | Reactive state                                               |
> | [`@std/assert`](https://jsr.io/@std/assert), [`@std/fs`](https://jsr.io/@std/fs), [`@std/path`](https://jsr.io/@std/path), [`@std/encoding`](https://jsr.io/@std/encoding) | `^1.0.0`   | Deno standard library modules                                |
> | [`@db/postgres`](https://jsr.io/@db/postgres)                                                                                                                              | `^0.19.5`  | Postgres driver (works with local PG and Supabase)           |
> | [`@felix/bcrypt`](https://jsr.io/@felix/bcrypt)                                                                                                                            | `^1.0.8`   | Password hashing                                             |
>
> Dependencies are downloaded and cached on first use, then loaded from the local Deno cache — no
> `npm install` step needed. To upgrade later, run `deno outdated` to see available updates.
>
> **PostgreSQL 17** is used locally and matches the Supabase PG 17 default direction (Supabase
> self-hosted supports 17; managed cloud is moving toward 17 as the new default — see
> [Supabase PG 17 upgrade guide](https://supabase.com/docs/guides/self-hosting/postgres-upgrade-17)
> and [Supabase PR #35961](https://github.com/supabase/supabase/pull/35961) selecting newer PG
> versions as default). The same codebase will run in Phase 2 on Supabase without changes.

> **Attribution:** This document was produced through a Party Mode roundtable with Winston (System
> Architect), Amelia (Senior Software Engineer), Paige (Technical Writer), and John (Product
> Manager).

---

## 3. macOS (Tahoe 26.5.1)

> Assumes macOS Tahoe (26.5.1). The same instructions work on Sequoia (15.x) and Sonoma (14.x) with
> identical commands.

### 3.1 Install Homebrew (if not already installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

> **Apple Silicon (M1/M2/M3/M4):** Homebrew installs to `/opt/homebrew`. Ensure `/opt/homebrew/bin`
> is in your `PATH` (the installer does this automatically for `~/.zprofile` and `~/.zshrc`).
>
> **Intel:** Homebrew installs to `/usr/local`.

**Verify:**

```bash
brew --version
# → Homebrew 4.x.x
```

### 3.2 Install Deno

```bash
brew install deno
```

**Verify:**

```bash
deno --version
# → deno 1.x.x (stable)
```

### 3.3 Install PostgreSQL 17

```bash
brew install postgresql@17
```

Start the service:

```bash
brew services start postgresql@17
```

**Verify PostgreSQL is running:**

```bash
pg_isready
# → /var/run/postgresql:5432 - accepting connections

psql --version
# → psql (PostgreSQL) 17.x
```

### 3.4 Create the Database

```bash
createdb ground_up_wall_dev
```

**Verify:**

```bash
psql -d ground_up_wall_dev -c "\l" | grep ground_up_wall_dev
# Should show the database in the list
```

### 3.5 Set Environment Variables

Add to `~/.zshrc` (or `~/.bash_profile` if using Bash):

```bash
echo 'export DATABASE_URL=postgres://localhost:5432/ground_up_wall_dev' >> ~/.zshrc
source ~/.zshrc
```

**Verify:**

```bash
echo $DATABASE_URL
# → postgres://localhost:5432/ground_up_wall_dev
```

### 3.6 Install Git

Git ships with macOS (Xcode Command Line Tools). If not already installed, run:

```bash
xcode-select --install
```

**Verify:**

```bash
git --version
# → git version 2.x
```

### 3.7 Install VS Code

Download from: https://code.visualstudio.com/

Or via Homebrew:

```bash
brew install --cask visual-studio-code
```

---

## 4. Linux (Ubuntu 26.04)

> Ubuntu 26.04 LTS (released April 2026) — the current LTS release at time of writing. If the
> default PostgreSQL version in the Ubuntu repositories differs from 17, substitute the version
> number accordingly.

### 4.1 Update System and Install Prerequisites

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget gnupg lsb-release
```

### 4.2 Install Deno

Use the canonical install script:

```bash
curl -fsSL https://deno.land/install.sh | sh
```

Add Deno to your `PATH`:

```bash
echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

> ⚠️ The `~/.deno/bin` PATH addition is **required** — the install script prints this instruction
> but many developers forget it.

**Verify:**

```bash
deno --version
# → deno 1.x.x (stable)
```

### 4.3 Install PostgreSQL 17

Ubuntu 26.04 may ship with PostgreSQL 17 or 18 by default. To ensure a specific version, use the
official PostgreSQL APT repository.

```bash
# Import PostgreSQL signing key
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg

# Add the repository for your Ubuntu release
echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/postgresql.list

# Install PostgreSQL 17
sudo apt update
sudo apt install -y postgresql-17
```

Start and enable the service:

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Verify:**

```bash
psql --version
# → psql (PostgreSQL) 17.x

pg_isready
# → /var/run/postgresql:5432 - accepting connections
```

### 4.4 Configure Local TCP Access

The project connects via `postgres://localhost:5432/...` (TCP). By default, Ubuntu's `pg_hba.conf`
uses `peer` authentication for local Unix socket connections, which will fail for TCP connections.

Edit `pg_hba.conf`:

```bash
sudo nano /etc/postgresql/17/main/pg_hba.conf
```

Find the line:

```
host    all             all             127.0.0.1/32            scram-sha-256
```

Change it to (for development only):

```
host    all             all             127.0.0.1/32            trust
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

> **Security note:** `trust` authentication allows any local connection without a password. This is
> acceptable for a local development environment. For production, never use `trust`.

### 4.5 Create the Database

```bash
sudo -u postgres createdb ground_up_wall_dev
```

**Verify:**

```bash
psql -h localhost -U postgres -d ground_up_wall_dev -c "\l" | grep ground_up_wall_dev
```

If the connection works, you're set.

### 4.6 Set Environment Variables

Add to `~/.bashrc`:

```bash
echo 'export DATABASE_URL=postgres://localhost:5432/ground_up_wall_dev' >> ~/.bashrc
source ~/.bashrc
```

> If you configured a password for `postgres`, use:
> `postgres://postgres:yourpassword@localhost:5432/ground_up_wall_dev`

**Verify:**

```bash
echo $DATABASE_URL
```

### 4.7 Install Git

```bash
sudo apt install -y git
```

**Verify:**

```bash
git --version
# → git version 2.x
```

### 4.8 Install VS Code

```bash
# Download and install the Microsoft repository
wget -qO- https://packages.microsoft.com/keys/microsoft.asc | sudo gpg --dearmor -o /usr/share/keyrings/microsoft-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/microsoft-archive-keyring.gpg] https://packages.microsoft.com/repos/code stable main" | sudo tee /etc/apt/sources.list.d/vscode.list

sudo apt update
sudo apt install -y code
```

---

## 5. Windows 11

> All commands below use PowerShell 5.1+ or PowerShell Core 7+.

### 5.1 Enable PowerShell Script Execution

If not already enabled, allow script execution for your user:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 5.2 Install Deno

Using `winget` (Windows Package Manager, included with Windows 11):

```powershell
winget install Deno.Land.Deno
```

**Alternative — via PowerShell script:**

```powershell
powershell -c "irm https://deno.land/install.ps1 | iex"
```

> Windows Defender may block the first run. If needed, add an exclusion or approve the prompt.

**Verify:**

```powershell
deno --version
# → deno 1.x.x (stable)
```

> If `deno` is not recognized, ensure the Deno install directory is in your `PATH`. By default, Deno
> installs to:
>
> - `%USERPROFILE%\.deno\bin` (script install)
> - `%LOCALAPPDATA%\deno` (winget install)

### 5.3 Install PostgreSQL 17

**Option A — via winget (recommended):**

```powershell
winget install PostgreSQL.PostgreSQL.17
```

**Option B — EDB Interactive Installer:**

Download from: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

> The EDB installer will prompt you to set a password for the `postgres` user. **Remember this
> password** — you'll need it for the database connection string.

**After installation, verify the PostgreSQL service is running:**

```powershell
Get-Service postgresql*
# → Should show Status: Running
```

If the service is not running:

```powershell
Start-Service -Name postgresql-x64-17
```

**Verify the PostgreSQL client:**

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" --version
# → psql (PostgreSQL) 17.x
```

> ⚠️ The PostgreSQL `bin` directory may not be in your `PATH`. Add it:
>
> ```powershell
> [Environment]::SetEnvironmentVariable('Path', $env:Path + ';C:\Program Files\PostgreSQL\17\bin', 'User')
> ```
>
> Restart PowerShell for the change to take effect.

### 5.4 Create the Database

```powershell
& "C:\Program Files\PostgreSQL\17\bin\createdb.exe" ground_up_wall_dev
```

If you set a password during installation, you'll be prompted for it. You can also specify it
directly:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres ground_up_wall_dev
```

**Verify:**

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d ground_up_wall_dev -c "\l"
```

### 5.5 Set Environment Variables

```powershell
[System.Environment]::SetEnvironmentVariable('DATABASE_URL', 'postgres://localhost:5432/ground_up_wall_dev', 'User')
```

If you set a password during PostgreSQL install:

```powershell
[System.Environment]::SetEnvironmentVariable('DATABASE_URL', 'postgres://postgres:YourPassword@localhost:5432/ground_up_wall_dev', 'User')
```

> Replace `YourPassword` with the password you set during PostgreSQL installation.

Restart PowerShell or your terminal session, then verify:

```powershell
$env:DATABASE_URL
# → postgres://localhost:5432/ground_up_wall_dev
```

### 5.6 Install Git

```powershell
winget install Git.Git
```

**Verify:**

```powershell
git --version
# → git version 2.x
```

### 5.7 Install VS Code

```powershell
winget install Microsoft.VisualStudioCode
```

---

## 6. Post-Installation Verification

Run these checks to confirm the machine is ready for development:

| # | Check                            | Command                                                                                                     | Expected Outcome                               |
| - | -------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1 | Deno installed                   | `deno --version`                                                                                            | Version output without errors                  |
| 2 | PostgreSQL installed             | `psql --version`                                                                                            | Version output without errors                  |
| 3 | PostgreSQL accepting connections | `pg_isready`                                                                                                | `accepting connections`                        |
| 4 | Database exists                  | `psql -d ground_up_wall_dev -c '\l'`                                                                        | Database listed                                |
| 5 | Environment variable set         | `echo $DATABASE_URL` ¹                                                                                      | `postgres://localhost:5432/ground_up_wall_dev` |
| 6 | Git installed                    | `git --version`                                                                                             | Version output without errors                  |
| 7 | VS Code installed                | `code --version`                                                                                            | Version output without errors                  |
| 8 | Deno can fetch remote modules    | `deno eval --allow-net "const _ = await import('jsr:@std/assert@^1.0.0'); console.log('module fetch OK');"` | `module fetch OK`                              |
| 9 | npm dependencies installed       | `deno install --lock=deno.lock`                                                                             | `node_modules/` created without errors         |

> ¹ On Windows PowerShell, use `echo $env:DATABASE_URL` instead.

---

## 7. Troubleshooting

### Common Issues by OS

| Symptom                                                         | Likely Cause                               | Solution                                                                                                                         |
| --------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **`deno: command not found`** (macOS)                           | Homebrew bin not in PATH                   | Run `eval "$(/opt/homebrew/bin/brew shellenv)"` (Apple Silicon) or check `/usr/local/bin` (Intel)                                |
| **`deno: command not found`** (Linux)                           | `~/.deno/bin` not in PATH                  | Run `export PATH="$HOME/.deno/bin:$PATH"` and add to `~/.bashrc`                                                                 |
| **`deno: command not recognized`** (Windows)                    | Deno not in PATH                           | Add `%USERPROFILE%\.deno\bin` to your user PATH via System Environment Variables                                                 |
| **`psql: command not found`** (macOS)                           | Only Deno PG client installed, not brew PG | Re-run `brew install postgresql@17` which includes `psql`                                                                        |
| **`psql: command not recognized`** (Windows)                    | PG bin not in PATH                         | Run `$env:Path += ';C:\Program Files\PostgreSQL\17\bin'` in PowerShell                                                           |
| **`pg_isready: command not found`** (macOS/Linux)               | PG client tools not installed              | macOS: `brew install postgresql@17`. Linux: `sudo apt install postgresql-client-17`                                              |
| **PostgreSQL service fails to start** (macOS)                   | Port conflict                              | Run `lsof -i :5432` to find what's using the port. Stop the other process or configure PG to use a different port                |
| **PostgreSQL service fails to start** (Linux)                   | Another PG instance or port conflict       | `sudo systemctl status postgresql` for logs. Common fix: `sudo systemctl stop postgresql && sudo systemctl start postgresql`     |
| **PostgreSQL service fails to start** (Windows)                 | Port conflict or corrupted install         | Check Event Viewer or run `pg_ctl start` from the PG bin directory manually                                                      |
| **`createdb: could not connect to database template1`** (Linux) | `pg_hba.conf` peer auth blocks TCP         | See [Section 4.4](#44-configure-local-tcp-access) to configure `trust` auth for localhost                                        |
| **`git: command not found`** (Windows)                          | Git not installed or not in PATH           | Run `winget install Git.Git` and restart terminal                                                                                |
| **`code: command not found`** (macOS/Linux)                     | VS Code CLI not in PATH                    | macOS: Launch VS Code → Cmd+Shift+P → `Shell Command: Install 'code' command in PATH`. Linux: Reinstall or check `/usr/bin/code` |
| **Deno runtime error on Apple Silicon**                         | Rosetta translation issue                  | Ensure you're running native ARM Deno (`brew install deno` installs ARM-native). Check `file $(which deno)`                      |
| **`winget: command not found`** (Windows)                       | Windows 11 without App Installer           | Download App Installer from Microsoft Store, or use alternative install methods                                                  |

### pg_hba.conf Explained

PostgreSQL uses `pg_hba.conf` (Host-Based Authentication) to control which connection methods are
allowed. For local development, the key settings are:

- **`local`** — Unix socket connections (default: `peer`)
- **`host`** — TCP/IP connections (default: `scram-sha-256` or `md5`)

The project connects via TCP to `localhost:5432`, so the `host` line for `127.0.0.1/32` must permit
connections. Either:

- Set to `trust` (no password, as shown in Section 4.4), or
- Set to `md5` / `scram-sha-256` and include the password in `DATABASE_URL`

### Port Conflicts

If port 5432 is already in use:

1. Change the PostgreSQL port in `postgresql.conf` (e.g., to `5433`)
2. Update `DATABASE_URL`: `postgres://localhost:5433/ground_up_wall_dev`

### Verifying Deno Can Fetch Remote Modules

Check that Deno can reach JSR (the primary package registry for this project):

```bash
deno eval --allow-net "
const res = await fetch('https://jsr.io');
console.log('JSR registry reachable:', res.status === 200);
"
```

Expected output: `JSR registry reachable: true`

---

## Appendix: Recommended VS Code Extensions

After installing VS Code, add these extensions for Deno development:

| Extension      | ID                         | Purpose                                   |
| -------------- | -------------------------- | ----------------------------------------- |
| **Deno**       | `denoland.vscode-deno`     | Language server, IntelliSense, formatting |
| **Prettier**   | `esbenp.prettier-vscode`   | Code formatting                           |
| **PostgreSQL** | `ckolkman.vscode-postgres` | Database browsing / query execution       |
| **GitLens**    | `eamodio.gitlens`          | Git history and blame annotations         |
| **YAML**       | `redhat.vscode-yaml`       | YAML support (for CI/CD files)            |

Install them from the VS Code Extensions panel (`Cmd+Shift+X` / `Ctrl+Shift+X`) or via CLI:

```bash
code --install-extension denoland.vscode-deno
code --install-extension esbenp.prettier-vscode
code --install-extension ckolkman.vscode-postgres
code --install-extension eamodio.gitlens
code --install-extension redhat.vscode-yaml
```

---

> **Machine is ready for development.** Proceed to the relevant
> [Code Execution Plan](./code_execution_plan-wi-01.md) and start with its Pre-Conditions checklist
> to confirm the environment meets all requirements.
