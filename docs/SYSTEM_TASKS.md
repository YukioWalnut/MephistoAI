# Desktop system tasks

## Scope

Version 0.5.0 adds a constrained desktop application manager. It is intentionally not a general-purpose shell, terminal, or arbitrary process-control interface.

## Setup

1. Open **System Tasks**.
2. Enable **Desktop application control** and save the permission.
3. Use **Add application from this computer** and select an application in the native file picker.
4. Give it a short alias. That alias is used for chat commands.
5. Ask Mephisto to open or close the registered app. The renderer asks for confirmation before sending the action to Electron's main process.

Examples: `Chrome را باز کن`, `Calculator را ببند`, `open Firefox`, `close Calculator`.

## Platform support

- Windows: register `.exe` files.
- macOS: register `.app` bundles. Launch uses `open -a`; close uses a fixed AppleScript quit handler and the registered app's display name.
- Linux: register executable files. Launch uses the selected executable directly; close sends SIGTERM to its tracked child PID.

No shell is used and no arbitrary arguments can be supplied. Windows close uses the system `taskkill.exe` with the tracked numeric PID and `/T`, without a shell.

## Safety boundaries

- Desktop automation permission defaults to off.
- Only paths selected through the native file picker can be registered.
- Launch and close operations require explicit user confirmation when requested from chat.
- The manager cannot execute arbitrary commands or browse the filesystem. On Windows, a close request for a registered app that Mephisto did not launch targets the executable image name from that app's allowlisted path (`taskkill /IM ... /T`); this can close every running instance with that exact image name. On macOS/Linux, closing remains limited to apps launched by Mephisto in the current session.
- Running process handles are held in memory only. After Mephisto exits, Windows can still request closure of a registered executable by its exact image name; macOS/Linux cannot claim ownership of an already-running app.
- Some applications delegate launch to another process or exit immediately; on those applications, reliable close tracking may not be available.
- Closing an app may cause it to display its own unsaved-work prompt. Mephisto does not bypass that prompt or force-delete user data.
