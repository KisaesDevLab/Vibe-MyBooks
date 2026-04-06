# Vibe MyBooks — Windows Installer

## Building the Installer

### Prerequisites
1. Install [Inno Setup 6+](https://jrsoftware.org/isinfo.php) on your Windows machine
2. Optionally create an `icon.ico` file (256x256 app icon) in this directory

### Build Steps
1. Open `kisbooks-setup.iss` in Inno Setup Compiler
2. Click **Build > Compile** (or press Ctrl+F9)
3. The installer EXE will be created in `installer/output/VibeMyBooks-Setup-1.0.0.exe`

Alternatively, from command line:
```
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" kisbooks-setup.iss
```

## What the Installer Does

1. **Checks for Docker Desktop** — if not installed, downloads and installs it silently
2. **Generates `.env`** — creates configuration with secure random JWT secret and encryption keys
3. **Builds Docker containers** — runs `docker compose up -d --build` (first run: 5-10 minutes)
4. **Waits for health check** — polls `http://localhost:3001/health` until the API is ready
5. **Opens browser** — navigates to `http://localhost:5173` for the setup wizard
6. **Creates shortcuts** — desktop icon and Start Menu group

## What Gets Installed

- Application files in `C:\Program Files\Vibe MyBooks\`
- Docker containers: `db` (PostgreSQL), `redis`, `api`, `web`, `worker`
- Docker volumes: `pgdata`, `redis-data`, `app-data` (persistent data)
- Desktop shortcut: `Vibe MyBooks` (starts containers + opens browser)
- Start Menu: `Vibe MyBooks` group with Start, Stop, and Uninstall

## Uninstalling

Use **Add/Remove Programs** or the Start Menu uninstaller. This will:
- Stop all Docker containers
- Remove Docker volumes (database + uploaded files)
- Remove application files

**Note:** Docker Desktop itself is NOT uninstalled — other applications may depend on it.

## Manual Start/Stop

- **Start:** Double-click the desktop shortcut, or run `VibeMyBooks.cmd`
- **Stop:** Run `StopVibeMyBooks.cmd` from the install directory, or press any key in the launcher window
- **Access:** Open `http://localhost:5173` in any browser

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Docker Desktop not starting" | Ensure WSL2 is enabled: `wsl --install` in admin PowerShell |
| "Port 3001 already in use" | Stop other services on port 3001, or change PORT in .env |
| "Containers won't build" | Check internet connection; Docker needs to pull base images |
| "Database connection refused" | Wait 30 seconds after starting; PostgreSQL needs time to initialize |
