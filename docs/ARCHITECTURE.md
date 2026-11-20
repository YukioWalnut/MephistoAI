# Architecture

- `electron/core`: personality, adaptive personality, emotion, lexical memory, vector memory, relationship, goal, decision, autonomy, reflection, speech and orchestration engines.
- `electron/providers`: common provider contract, Ollama adapter and OpenAI-compatible chat-completions adapter.
- `electron/security`: permission normalization and enforcement.
- `electron/services`: bounded background maintenance activities and a generic HTTPS external-service REST manager.
- `electron/main.cjs`: SQLite migrations, IPC handlers, provider orchestration and opt-in scheduler.
- `electron/preload.cjs`: narrow context bridge.
- `src`: React interface and avatar presentation.

A message passes through persistence, emotion/relationship updates, Ollama embedding-based hybrid memory retrieval (or lexical fallback), goal context, decision selection, personality/speech prompt composition, provider generation, response filtering, persistence, deterministic reflection and repeated-explicit-feedback adaptation. Core personality defaults remain separate from bounded adaptive trait/style offsets driven by repeated explicit feedback and repeated reflection findings. External services are managed through explicit IPC methods with encrypted bearer tokens and per-connection read/write scopes. State is stored in SQLite and survives application restarts.

Personality traits are stable configuration. Modeled emotions and relationship dimensions are separate mutable state. Preferences require repeated or explicit conversational evidence and do not rewrite core traits. Autonomy uses explicit settings and bounded activity types.

Semantic vectors are stored in `semantic_vectors`, keyed by item type and ID and tagged with the embedding model. Changing the embedding model causes vectors to be regenerated lazily. Adaptive offsets and their evidence history are persisted in application state and `adaptive_personality_events`.


### SystemTaskManager

`electron/services/SystemTaskManager.cjs` stores a user-selected application allowlist in SQLite and launches only registered paths. Renderer access is mediated by narrow IPC methods (`system:*`) exposed through preload. The renderer parses a small set of explicit open/close phrases against registered aliases and always asks for confirmation before execution. It does not allow arbitrary shell commands, free-form paths, or command-line arguments. Running-process handles are kept in memory and are not persisted across restarts.
