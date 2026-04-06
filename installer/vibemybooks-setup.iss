; Vibe MyBooks — Inno Setup Script
; Builds a Windows installer EXE
;
; Prerequisites: Install Inno Setup 6+ from https://jrsoftware.org/isinfo.php
; Build: Open this file in Inno Setup Compiler and click Build > Compile
;        Or run: ISCC.exe kisbooks-setup.iss

#define AppName "Vibe MyBooks"
#define AppVersion "1.0.0"
#define AppPublisher "Kisaes LLC"
#define AppURL "https://github.com/kisaes/kis-books"
#define AppExeName "VibeMyBooks.cmd"

[Setup]
AppId={{B8F2E3A1-7D4C-4E9A-B5F6-1A2B3C4D5E6F}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
LicenseFile=..\LICENSE
OutputDir=output
OutputBaseFilename=VibeMyBooks-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\icon.ico
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
WelcomeLabel2=This will install [name/ver] on your computer.%n%n{#AppName} is a self-hosted bookkeeping application that runs in Docker containers.%n%nThe installer will:%n  1. Check for Docker Desktop (install if needed)%n  2. Set up the application containers%n  3. Create desktop and Start Menu shortcuts%n%nNote: Docker Desktop requires Windows 10/11 with WSL2 or Hyper-V.

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: checked
Name: "startdocker"; Description: "Start Vibe MyBooks after installation"; GroupDescription: "Post-install:"; Flags: checked

[Files]
; Application files
Source: "..\docker-compose.yml"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\docker-compose.dev.yml"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\docker-compose.prod.yml"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\Dockerfile"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\packages\api\Dockerfile"; DestDir: "{app}\packages\api"; Flags: ignoreversion
Source: "..\packages\web\Dockerfile"; DestDir: "{app}\packages\web"; Flags: ignoreversion
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\package-lock.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\packages\*"; DestDir: "{app}\packages"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "node_modules\*,dist\*,*.tsbuildinfo"
Source: "..\scripts\*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs
Source: "..\e2e\*"; DestDir: "{app}\e2e"; Flags: ignoreversion recursesubdirs
Source: "..\tsconfig.base.json"; DestDir: "{app}"; Flags: ignoreversion
Source: ".\env.example"; DestDir: "{app}"; DestName: ".env.example"; Flags: ignoreversion
; Launcher scripts
Source: "VibeMyBooks.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "StopVibeMyBooks.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "setup.ps1"; DestDir: "{app}\installer"; Flags: ignoreversion
; Icon (create a simple icon or use a placeholder)
Source: "icon.ico"; DestDir: "{app}"; Flags: ignoreversion; Check: FileExists('icon.ico')

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; Comment: "Start Vibe MyBooks"
Name: "{group}\Stop {#AppName}"; Filename: "{app}\StopVibeMyBooks.cmd"; WorkingDir: "{app}"; Comment: "Stop Vibe MyBooks"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon; Comment: "Start Vibe MyBooks"

[Run]
; Run the PowerShell setup script after installation
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -File ""{app}\installer\setup.ps1"" -InstallDir ""{app}"""; \
  StatusMsg: "Configuring Vibe MyBooks (this may take several minutes)..."; \
  Flags: runhidden waituntilterminated; \
  Check: not WizardSilent

; Open the app after install (if user checked the task)
Filename: "{app}\{#AppExeName}"; \
  Description: "Start {#AppName}"; \
  Flags: shellexec postinstall nowait; \
  Tasks: startdocker

[UninstallRun]
; Stop containers on uninstall
Filename: "powershell.exe"; \
  Parameters: "-ExecutionPolicy Bypass -File ""{app}\installer\setup.ps1"" -InstallDir ""{app}"" -Uninstall"; \
  Flags: runhidden waituntilterminated

[UninstallDelete]
Type: filesandordirs; Name: "{app}\data"
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\.env"

[Code]
// Check if Docker Desktop is installed during setup
function DockerInstalled(): Boolean;
begin
  Result := FileExists(ExpandConstant('{pf}\Docker\Docker\Docker Desktop.exe')) or
            FileExists(ExpandConstant('{pf64}\Docker\Docker\Docker Desktop.exe'));
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  // Show warning if Docker not installed
  if not DockerInstalled() then
  begin
    if MsgBox('Docker Desktop is not installed. The installer will attempt to download and install it automatically.' + #13#10 + #13#10 +
              'Docker Desktop requires:' + #13#10 +
              '  - Windows 10/11 (64-bit)' + #13#10 +
              '  - WSL2 or Hyper-V enabled' + #13#10 +
              '  - 4GB+ RAM' + #13#10 + #13#10 +
              'Continue with installation?',
              mbConfirmation, MB_YESNO) = IDNO then
    begin
      Result := False;
    end;
  end;
end;
