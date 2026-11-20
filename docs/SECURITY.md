# Security and privacy

- Renderer uses context isolation, disabled Node integration and Electron sandboxing; only explicit IPC methods are exposed from preload.
- Chat, memories, knowledge, goals and cognitive state are stored in local SQLite.
- External provider use is off by default and requires the explicit `externalProviderPermission` setting. External provider URLs must use HTTPS; local HTTP is accepted only for loopback hosts.
- API keys are encrypted with Electron `safeStorage`; saving is refused when OS-backed encryption is unavailable. Keys are not returned to the renderer after saving.
- Web ingestion is a separate explicit action, accepts HTTP/HTTPS only, rejects private/local DNS destinations and does not follow redirects. As with any DNS-based fetch guard, production deployment should additionally pin the resolved destination at the transport layer to fully mitigate DNS rebinding.
- Autonomy, proactive messages and background maintenance are off by default. When enabled, scheduler activity runs only while the app process is open and is subject to quiet hours, daily limits and minimum intervals.
- No arbitrary command execution, unattended file access, email or external messaging is implemented.
- The JSON export contains conversation history and stored data; keep backup files private.

- External service connections require a separate global `externalServicesPermission`, use public HTTPS URLs only, reject local/private DNS results and disable redirects. Optional bearer tokens are encrypted with Electron `safeStorage` and are never returned to the renderer. Each connection has explicit `read` and/or `write` scopes; only GET/POST are supported, and each request is initiated by a user action. This generic REST interface is not an OAuth integration and does not provide provider-specific permission scopes. DNS validation followed by ordinary fetch is not full DNS-rebinding protection; high-assurance deployments should pin the validated address at the transport layer.
- Embedding requests are sent to the configured local Ollama endpoint, not the external chat provider. Install the embedding model locally; if it cannot be reached, the application falls back to lexical retrieval.
- Adaptive personality updates require repeated explicit feedback or repeated reflection findings, are bounded to ±10 per trait/style dimension, are recorded and can be reset. Core identity defaults are not rewritten.


## Desktop application control

Desktop automation is a separate opt-in permission (`desktopAutomationPermission`) and is disabled by default. Applications must be registered through the native file picker. Windows accepts `.exe` files, macOS accepts `.app` bundles, and Linux accepts executable files. Launch uses `spawn` with `shell: false`, an empty argument list, and the exact selected path. No arbitrary command strings or shell fragments are accepted. Close is restricted to applications launched by Mephisto in the current session; arbitrary process enumeration and termination are not exposed. On Windows, `taskkill.exe` is invoked with a numeric PID argument and without a shell; on Linux, SIGTERM is sent only to the tracked child PID; on macOS, a fixed AppleScript quit handler receives the registered app display name as an argument.
