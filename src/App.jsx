import React, { useEffect, useState } from "react";
import Avatar from "./components/Avatar.jsx";

function normalizeCommandText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک")
    .replace(/[\u200c\u200f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSystemCommand(text, apps) {
  const normalized = normalizeCommandText(text);

  if (/(نبند|باز نکن|نمی خواهم|نمیخوام|don't|do not)\s*/i.test(normalized)) {
    return null;
  }

  const open = [
    "باز کن",
    "بازش کن",
    "اجرا کن",
    "راه اندازی کن",
    "راه‌اندازی کن",
    "open",
    "launch",
    "start"
  ];

  const close = [
    "ببند",
    "ببندش",
    "بند",
    "خارج شو",
    "close",
    "quit",
    "exit"
  ];

  const action = open.some(v => normalized.includes(v))
    ? "open"
    : close.some(v => normalized.includes(v))
      ? "close"
      : null;

  if (!action) return null;

  const app = (apps || []).find(item =>
    normalized.includes(normalizeCommandText(item.name))
  );

  return app ? { action, app } : null;
}

// تشخیص نام برنامه Chess
function isChessApplication(app) {
  const name = String(app?.name || "").trim();

  const executablePath = String(
    app?.executable_path || app?.executablePath || ""
  ).trim();

  const normalizedName = name
    .replace(/\.exe$/i, "")
    .trim();

  const normalizedPath = executablePath
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.exe$/i, "")
    .trim() || "";

  const chessPattern = /^mephisto[\s_-]*chess$/i;
  const simpleChessPattern = /^chess$/i;

  return (
    chessPattern.test(normalizedName) ||
    simpleChessPattern.test(normalizedName) ||
    chessPattern.test(normalizedPath) ||
    simpleChessPattern.test(normalizedPath)
  );
}

const tabs = [
  { id: "chat", label: "Conversation", icon: "✦" },
  { id: "memory", label: "Memories", icon: "◈" },
  { id: "knowledge", label: "Knowledge", icon: "⌘" },
  { id: "goals", label: "Goals", icon: "◎" },
  { id: "insights", label: "Insights", icon: "◉" },
  { id: "personality", label: "Personality", icon: "♜" },
  { id: "services", label: "Services", icon: "⇄" },
  { id: "system", label: "System Tasks", icon: "⌘" },
  { id: "chess", label: "Chess", icon: "♟" },
  { id: "settings", label: "Settings", icon: "⚙" }
];

export default function App() {
  const [tab, setTab] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [emotion, setEmotion] = useState({});
  const [relationship, setRelationship] = useState(0);
  const [memories, setMemories] = useState([]);
  const [knowledge, setKnowledge] = useState([]);

  const [settings, setSettings] = useState({
    ollamaUrl: "http://127.0.0.1:11434",
    model: "qwen2.5:7b",
    provider: "ollama",
    providerUrl: "http://127.0.0.1:11434",
    providerModel: "",
    providerApiKey: "",
    autonomy: {
      enabled: false,
      allowBackground: false,
      allowProactiveMessages: false
    },
    permissions: {}
  });

  const [status, setStatus] = useState("Connecting to local AI…");
  const [error, setError] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeText, setKnowledgeText] = useState("");
  const [url, setUrl] = useState("");

  const [dashboard, setDashboard] = useState({
    goals: [],
    decisions: [],
    events: [],
    relationship: {},
    stage: "Stranger"
  });

  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [activityStatus, setActivityStatus] = useState("");

  const [services, setServices] = useState([]);
  const [serviceName, setServiceName] = useState("");
  const [serviceUrl, setServiceUrl] = useState("");
  const [serviceToken, setServiceToken] = useState("");
  const [serviceScopes, setServiceScopes] = useState(["read"]);
  const [servicePath, setServicePath] = useState("");
  const [serviceMethod, setServiceMethod] = useState("GET");
  const [serviceBody, setServiceBody] = useState("{}");
  const [serviceOutput, setServiceOutput] = useState("");

  const [systemApps, setSystemApps] = useState([]);
  const [systemStatus, setSystemStatus] = useState("");
  const [pendingSystemAction, setPendingSystemAction] = useState(null);
  const [appRegistrationPath, setAppRegistrationPath] = useState("");
  const [appRegistrationName, setAppRegistrationName] = useState("");

  async function refresh() {
    try {
      const [
        h,
        m,
        k,
        s,
        d,
        sv,
        apps
      ] = await Promise.all([
        window.mephisto.history(),
        window.mephisto.memories(),
        window.mephisto.knowledge(),
        window.mephisto.settings(),
        window.mephisto.dashboard(),
        window.mephisto.services(),
        window.mephisto.systemApps()
      ]);

      setMessages(h);
      setMemories(m);
      setKnowledge(k);
      setServices(sv || []);
      setSystemApps(apps || []);
      setEmotion(s.emotion || {});
      setDashboard(d);
      setRelationship(d.relationship || {});

      setSettings(x => ({
        ...x,
        ...s,
        providerApiKey: x.providerApiKey || ""
      }));

      setStatus("Local database ready");
    } catch (e) {
      setStatus("Desktop bridge unavailable");
    }
  }

  useEffect(() => {
    refresh();

    const unsubscribe = window.mephisto.onAutonomousMessage?.(
      () => refresh()
    );

    return () => unsubscribe?.();
  }, []);

  async function send(e) {
    e?.preventDefault();

    const text = input.trim();

    if (!text || busy) return;

    const systemCommand = detectSystemCommand(text, systemApps);

    setInput("");
    setError("");

    setMessages(v => [
      ...v,
      { role: "user", content: text, local: true }
    ]);

    if (systemCommand) {
      if (!settings.permissions?.desktopAutomationPermission) {
        setError(
          "برای اجرای تسک سیستمی، ابتدا مجوز Desktop application control را در بخش System Tasks فعال کن."
        );
        return;
      }

      if (
        systemCommand.action === "close" &&
        !systemCommand.app.running
      ) {
        setMessages(v => [
          ...v,
          {
            role: "assistant",
            content: `من ${systemCommand.app.name} را در این نشست اجرا نکرده‌ام؛ فقط برنامه‌هایی را می‌توانم ببندم که خودم در همین نشست باز کرده‌ام.`,
            local: true
          }
        ]);

        return;
      }

      setPendingSystemAction(systemCommand);

      setMessages(v => [
        ...v,
        {
          role: "assistant",
          content: `درخواست انجام کار سیستمی شناسایی شد: ${systemCommand.action === "open" ? "باز کردن" : "بستن"} «${systemCommand.app.name}». برای اجرای آن تأیید لازم است.`,
          local: true
        }
      ]);

      return;
    }

    setBusy(true);

    const result = await window.mephisto.send(text);

    setBusy(false);

    if (result.error) {
      setError(result.error + " — " + (result.hint || ""));
      return;
    }

    setMessages(v => [
      ...v,
      { role: "assistant", content: result.reply, local: true }
    ]);

    setEmotion(result.emotion || {});
    setRelationship(result.relationship || 0);

    refresh();
  }

  async function addMemory(e) {
    e.preventDefault();

    if (!memoryText.trim()) return;

    await window.mephisto.addMemory({
      content: memoryText,
      category: "personal",
      importance: 4
    });

    setMemoryText("");
    refresh();
  }

  async function addKnowledge(e) {
    e.preventDefault();

    if (!knowledgeText.trim()) return;

    await window.mephisto.addKnowledge({
      title: knowledgeTitle || "Personal note",
      content: knowledgeText
    });

    setKnowledgeTitle("");
    setKnowledgeText("");
    refresh();
  }

  async function importFiles() {
    try {
      const n = await window.mephisto.importKnowledge();

      setStatus(`${n} file(s) imported`);
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function learnWeb(e) {
    e.preventDefault();

    try {
      const r = await window.mephisto.learnWeb(url);

      setStatus(`Learned ${r.characters} characters from ${r.title}`);
      setUrl("");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveSettings(e) {
    e?.preventDefault?.();

    try {
      await window.mephisto.saveSettings(settings);

      setSettings(x => ({
        ...x,
        providerApiKey: ""
      }));

      setStatus("Settings saved");
    } catch (err) {
      setError(err.message);
    }
  }

  async function createService(e) {
    e.preventDefault();

    try {
      await window.mephisto.addService({
        name: serviceName,
        baseUrl: serviceUrl,
        token: serviceToken,
        scopes: serviceScopes,
        enabled: true
      });

      setServiceName("");
      setServiceUrl("");
      setServiceToken("");

      setServiceOutput(
        "Connection saved. Credentials are encrypted locally."
      );

      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function editService(service) {
    const name = window.prompt("Service name", service.name);
    if (name === null) return;

    const baseUrl = window.prompt(
      "Public HTTPS base URL",
      service.base_url
    );
    if (baseUrl === null) return;

    const scopesText = window.prompt(
      "Scopes: read,write",
      (service.scopes || []).join(",")
    );
    if (scopesText === null) return;

    const token = window.prompt(
      "New bearer token (leave empty to keep current token)",
      ""
    );
    if (token === null) return;

    try {
      await window.mephisto.updateService({
        id: service.id,
        name,
        baseUrl,
        scopes: scopesText.split(",").map(x => x.trim()),
        token
      });

      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function testService(id) {
    try {
      const r = await window.mephisto.testService(id);

      setServiceOutput(`HTTP ${r.status} · ${r.body}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function callService(id) {
    try {
      const body =
        serviceMethod === "POST"
          ? JSON.parse(serviceBody || "{}")
          : null;

      const r = await window.mephisto.requestService({
        id,
        method: serviceMethod,
        path: servicePath,
        body
      });

      setServiceOutput(`HTTP ${r.status} · ${r.body}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addSystemApp() {
    try {
      const executablePath = await window.mephisto.chooseSystemApp();

      if (!executablePath) return;

      const suggested = executablePath
        .split(/[\\/]/)
        .pop()
        .replace(/\.app$/i, "")
        .replace(/\.exe$/i, "");

      setAppRegistrationPath(executablePath);
      setAppRegistrationName(suggested);
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmAddSystemApp(e) {
    e?.preventDefault?.();

    const name = appRegistrationName.trim();

    if (!name) {
      setError("برای برنامه یک نام وارد کن.");
      return;
    }

    try {
      await window.mephisto.addSystemApp({
        name,
        executablePath: appRegistrationPath
      });

      setSystemStatus(`${name} added to the application allowlist.`);

      setAppRegistrationPath("");
      setAppRegistrationName("");
      setError("");

      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function runSystemAction() {
    if (!pendingSystemAction) return;

    try {
      const { action, app } = pendingSystemAction;

      if (action === "open") {
        await window.mephisto.launchSystemApp(app.id);
      } else {
        await window.mephisto.closeSystemApp(app.id);
      }

      setMessages(v => [
        ...v,
        {
          role: "assistant",
          content:
            action === "open"
              ? `${app.name} برای اجرا فراخوانی شد.`
              : `درخواست بستن ${app.name} ارسال شد.`,
          local: true
        }
      ]);

      setSystemStatus(
        action === "open"
          ? `${app.name} launch requested.`
          : `${app.name} close requested.`
      );

      setPendingSystemAction(null);

      setSystemApps(await window.mephisto.systemApps());
    } catch (err) {
      setError(err.message);
      setPendingSystemAction(null);
    }
  }

  // اصلاح اصلی: تشخیص Chess با نام یا مسیر فایل اجرایی
  const chessApp = systemApps.find(isChessApplication);

  async function openChess() {
    setError("");

    if (!settings.permissions?.desktopAutomationPermission) {
      setError(
        "برای اجرای Chess ابتدا مجوز Desktop application control را در بخش System Tasks فعال کن."
      );
      return;
    }

    if (!chessApp) {
      setError(
        "برنامه Chess هنوز ثبت نشده است. ابتدا فایل اجرایی Mephisto Chess را در بخش System Tasks ثبت کن."
      );

      setTab("system");
      return;
    }

    try {
      await window.mephisto.launchSystemApp(chessApp.id);

      setSystemStatus("Mephisto Chess launch requested.");
      setStatus("Opening Mephisto Chess…");

      setSystemApps(await window.mephisto.systemApps());
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeSystemApp(id) {
    try {
      await window.mephisto.removeSystemApp(id);

      setSystemStatus("Application removed from the allowlist.");

      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  // Display only the emotional values returned by Mephisto's core.
  // No client-side emotion guessing or avatar animation changes are made here.
  const emotionNames = {
    happiness: "Happiness",
    sadness: "Sadness",
    anger: "Anger",
    curiosity: "Curiosity",
    excitement: "Excitement",
    embarrassment: "Embarrassment",
    trust: "Trust",
    affection: "Affection",
    jealousy: "Jealousy",
    loneliness: "Loneliness",
    calmness: "Calmness",
    annoyance: "Annoyance",
    pride: "Pride",
    fear: "Fear",
    longing: "Longing",
    surprise: "Surprise",
    disgust: "Disgust",
    guilt: "Guilt",
    gratitude: "Gratitude",
    hope: "Hope",
    empathy: "Empathy",
    confidence: "Confidence",
    insecurity: "Insecurity",
    boredom: "Boredom",
    determination: "Determination",
    admiration: "Admiration",
    regret: "Regret",
    relief: "Relief",
    shame: "Shame",
    confusion: "Confusion"
  };

  const emotionEntries = Object.entries(emotion || {})
    .filter(([, value]) => Number.isFinite(Number(value)))
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  const emotionLabel = key =>
    emotionNames[key] ||
    key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());

  const relationScore = Math.round(
    Object.values(dashboard.relationship || {})
      .reduce((a, b) => a + Number(b || 0), 0) / 6
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="sigil">M</div>
          <div>
            <b>MEPHISTO</b>
            <small>LOCAL COMPANION</small>
          </div>
        </div>

        <div className="profile-mini">
          <div className="avatar-dot">M</div>
          <div>
            <b>Mephisto</b>
            <small>Vampire • Tsundere</small>
          </div>
          <span className="online" />
        </div>

        <div className="nav-label">WORKSPACE</div>

        {tabs.map(t => (
          <button
            key={t.id}
            className={`nav ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}

        <div className="sidebar-bottom">
          <div className="status-line">
            <i />
            {status}
          </div>
          <div className="version">MEPHISTO CORE · 0.5.0</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">YOUR PERSONAL AI</span>
            <h1>{tabs.find(t => t.id === tab)?.label}</h1>
          </div>

          <div className="top-right">
            <span className="local-pill">● LOCAL MODE</span>
            <button
              className="icon-button"
              title="Export backup"
              onClick={() => window.mephisto.exportBackup()}
            >
              ⇩
            </button>
          </div>
        </header>

        {appRegistrationPath && (
          <div className="system-confirm-backdrop">
            <form
              className="panel system-confirm"
              onSubmit={confirmAddSystemApp}
            >
              <span className="eyebrow">REGISTER DESKTOP APPLICATION</span>
              <h2>ثبت برنامه جدید</h2>

              <p>
                برای این برنامه یک نام یا عبارت فرمان وارد کن. بعداً می‌توانی
                در گفتگو بگویی «{appRegistrationName || "نام برنامه"} را باز کن».
              </p>

              <label htmlFor="app-registration-name">
                نام برنامه / فرمان چت
              </label>

              <input
                id="app-registration-name"
                autoFocus
                value={appRegistrationName}
                onChange={e => setAppRegistrationName(e.target.value)}
                placeholder="مثلاً Chrome"
                required
              />

              <small className="muted">{appRegistrationPath}</small>

              <div className="button-row">
                <button className="primary" type="submit">
                  ثبت برنامه
                </button>

                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setAppRegistrationPath("");
                    setAppRegistrationName("");
                  }}
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        )}

        {pendingSystemAction && (
          <div className="system-confirm-backdrop">
            <div className="panel system-confirm">
              <span className="eyebrow">SYSTEM ACTION APPROVAL</span>
              <h2>تأیید انجام کار</h2>

              <p>
                آیا اجازه می‌دهی مفیستو{" "}
                {pendingSystemAction.action === "open"
                  ? "برنامه"
                  : "درخواست بستن برنامه"}{" "}
                <b>{pendingSystemAction.app.name}</b> را{" "}
                {pendingSystemAction.action === "open"
                  ? "اجرا کند"
                  : "ببندد"}؟
              </p>

              <small>
                این اقدام فقط برای برنامه‌ای انجام می‌شود که خودت به فهرست
                برنامه‌های مجاز اضافه کرده‌ای.
              </small>

              <div className="button-row">
                <button className="primary" onClick={runSystemAction}>
                  تأیید و اجرا
                </button>

                <button
                  className="secondary"
                  onClick={() => setPendingSystemAction(null)}
                >
                  انصراف
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "chat" && (
          <section className="chat-layout">
            <div className="avatar-panel">
              <Avatar emotion={emotion} />

              <div className="avatar-caption">
                <span className="live-dot" /> MEPhisto{" "}
                <small>At your side, for now.</small>
              </div>

              <div className="relationship">
                <div className="row-between">
                  <span>RELATIONSHIP</span>
                  <b>{relationScore}%</b>
                </div>

                <div className="meter">
                  <i style={{ width: `${relationScore}%` }} />
                </div>

                <small>Trust is earned, not given.</small>
              </div>
            </div>

            <div className="conversation">
              <div className="conversation-head">
                <div>
                  <b>Private conversation</b>
                  <small>Messages are stored on this device.</small>
                </div>
                <span className="secure">⌑ LOCAL STORAGE</span>
              </div>

              <div className="messages">
                {messages.length === 0 && (
                  <div className="welcome">
                    <div className="welcome-mark">✦</div>
                    <h2>Well, well…</h2>
                    <p>
                      You've finally arrived. Don't misunderstand — I wasn't
                      waiting for you.
                    </p>
                    <small>Start a conversation with Mephisto.</small>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div
                    key={m.id || i}
                    className={`message ${m.role}`}
                  >
                    <div className="message-avatar">
                      {m.role === "assistant" ? "M" : "Y"}
                    </div>

                    <div>
                      <small>
                        {m.role === "assistant" ? "MEPHISTO" : "YOU"}
                      </small>
                      <p>{m.content}</p>
                    </div>
                  </div>
                ))}

                {busy && (
                  <div className="message assistant">
                    <div className="message-avatar">M</div>
                    <div>
                      <small>MEPHISTO</small>
                      <p className="typing">
                        Thinking<span>.</span><span>.</span><span>.</span>
                      </p>
                    </div>
                  </div>
                )}

                <div id="bottom" />
              </div>

              {error && <div className="error">{error}</div>}

              <form className="composer" onSubmit={send}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Say something to Mephisto…"
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(e);
                    }
                  }}
                />

                <button
                  disabled={busy || !input.trim()}
                  className="send"
                >
                  ↑
                </button>
              </form>

              <div className="composer-foot">
                <span>ENTER TO SEND · SHIFT + ENTER FOR NEW LINE</span>
                <span>LOCAL MEMORY ACTIVE</span>
              </div>
            </div>
          </section>
        )}

        {tab === "memory" && (
          <section className="page">
            <div className="page-intro">
              <h2>Long-term memories</h2>
              <p>
                Facts and preferences saved by you or extracted from explicit
                statements, with confidence and source metadata.
              </p>
            </div>

            <form className="panel form-panel" onSubmit={addMemory}>
              <label>ADD A MEMORY</label>

              <textarea
                value={memoryText}
                onChange={e => setMemoryText(e.target.value)}
                placeholder="Example: I prefer quiet places and late-night conversations."
              />

              <button className="primary">Save memory</button>
            </form>

            <div className="list-head">
              <b>Stored memories</b>
              <span>{memories.length} entries</span>
            </div>

            {memories.map(m => (
              <div className="data-card" key={m.id}>
                <div>
                  <p>{m.content}</p>
                  <small>
                    {m.category} · importance {m.importance} · confidence{" "}
                    {Math.round((m.confidence || 0) * 100)}% · {m.created_at}
                  </small>
                </div>

                <button
                  className="secondary"
                  onClick={async () => {
                    const content = window.prompt("Edit memory", m.content);

                    if (content?.trim()) {
                      await window.mephisto.editMemory({ ...m, content });
                      refresh();
                    }
                  }}
                >
                  Edit
                </button>

                <button
                  className="delete"
                  onClick={async () => {
                    await window.mephisto.deleteMemory(m.id);
                    refresh();
                  }}
                >
                  Delete
                </button>
              </div>
            ))}

            {!memories.length && (
              <div className="empty">No memories saved yet.</div>
            )}
          </section>
        )}

        {tab === "knowledge" && (
          <section className="page">
            <div className="page-intro">
              <h2>Knowledge library</h2>
              <p>
                Give Mephisto reference material. Imported content is stored
                locally and added to her chat context.
              </p>
            </div>

            <div className="two-panels">
              <form
                className="panel form-panel"
                onSubmit={addKnowledge}
              >
                <label>ADD TEXT KNOWLEDGE</label>

                <input
                  value={knowledgeTitle}
                  onChange={e => setKnowledgeTitle(e.target.value)}
                  placeholder="Title"
                />

                <textarea
                  value={knowledgeText}
                  onChange={e => setKnowledgeText(e.target.value)}
                  placeholder="Paste notes, facts, or reference material…"
                />

                <button className="primary">Add to library</button>
              </form>

              <div className="panel form-panel">
                <label>IMPORT FILES</label>

                <p className="muted">
                  Import TXT, Markdown, JSON, CSV or HTML files from your
                  computer.
                </p>

                <button className="secondary" onClick={importFiles}>
                  Choose files
                </button>

                <div className="divider" />

                <label>LEARN FROM THE WEB</label>

                <form onSubmit={learnWeb}>
                  <input
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://example.com/article"
                    type="url"
                    required
                  />

                  <button className="primary">Fetch and store page</button>
                </form>

                <small className="muted">
                  Only fetch URLs you trust. Page content is stored locally;
                  this is retrieval, not model fine-tuning.
                </small>
              </div>
            </div>

            <div className="list-head">
              <b>Knowledge sources</b>
              <span>{knowledge.length} entries</span>
            </div>

            {knowledge.map(k => (
              <div className="data-card" key={k.id}>
                <div>
                  <p>{k.title}</p>
                  <small>{k.source} · {k.preview}</small>
                </div>

                <button
                  className="delete"
                  onClick={async () => {
                    await window.mephisto.deleteKnowledge(k.id);
                    refresh();
                  }}
                >
                  Delete
                </button>
              </div>
            ))}

            {!knowledge.length && (
              <div className="empty">Your knowledge library is empty.</div>
            )}
          </section>
        )}

        {tab === "goals" && (
          <section className="page">
            <div className="page-intro">
              <h2>Goal engine</h2>
              <p>
                Track practical and creative goals with persistent progress.
              </p>
            </div>

            <form
              className="panel form-panel"
              onSubmit={async e => {
                e.preventDefault();

                if (!goalTitle.trim()) return;

                await window.mephisto.addGoal({
                  title: goalTitle,
                  description: goalDescription
                });

                setGoalTitle("");
                setGoalDescription("");
                refresh();
              }}
            >
              <label>CREATE GOAL</label>

              <input
                value={goalTitle}
                onChange={e => setGoalTitle(e.target.value)}
                placeholder="Goal title"
              />

              <textarea
                value={goalDescription}
                onChange={e => setGoalDescription(e.target.value)}
                placeholder="Description and success criteria"
              />

              <button className="primary">Create goal</button>
            </form>

            <div className="list-head">
              <b>Tracked goals</b>
              <span>{dashboard.goals.length} goals</span>
            </div>

            {dashboard.goals.map(g => (
              <div className="data-card" key={g.id}>
                <div style={{ flex: 1 }}>
                  <p>{g.title}</p>
                  <small>
                    {g.category} · {g.status} · priority {g.priority}
                  </small>

                  <div className="meter">
                    <i style={{ width: `${g.progress}%` }} />
                  </div>

                  <input
                    aria-label="Goal progress"
                    type="range"
                    min="0"
                    max="100"
                    value={g.progress}
                    onChange={async e => {
                      await window.mephisto.updateGoal({
                        id: g.id,
                        progress: Number(e.target.value),
                        status:
                          Number(e.target.value) === 100
                            ? "Completed"
                            : "Active"
                      });

                      refresh();
                    }}
                  />
                </div>

                <button
                  className="delete"
                  onClick={async () => {
                    await window.mephisto.deleteGoal(g.id);
                    refresh();
                  }}
                >
                  Delete
                </button>
              </div>
            ))}

            {!dashboard.goals.length && (
              <div className="empty">No goals yet.</div>
            )}
          </section>
        )}

        {tab === "insights" && (
          <section className="page">
            <div className="page-intro">
              <h2>Cognitive state</h2>
              <p>
                Persisted modeled emotions, relationship dimensions and
                decision history.
              </p>
            </div>

            <div className="panel emotion-panel">
              <div className="list-head">
                <b>Current emotional state</b>
                <span>Returned by Mephisto core</span>
              </div>

              {emotionEntries.length ? (
                emotionEntries.map(([key, value]) => (
                  <div className="emotion-row" key={key}>
                    <span>{emotionLabel(key)}</span>
                    <div className="meter">
                      <i
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, Number(value) || 0)
                          )}%`
                        }}
                      />
                    </div>
                    <b>{Math.round(Number(value) || 0)}</b>
                  </div>
                ))
              ) : (
                <div className="empty">
                  No emotional values have been returned by the core yet.
                </div>
              )}
            </div>

            <div className="panel emotion-panel">
              <div className="list-head">
                <b>Relationship stage</b>
                <span>{dashboard.stage}</span>
              </div>

              {Object.entries(dashboard.relationship || {}).map(([k, v]) => (
                <div className="emotion-row" key={k}>
                  <span>{k}</span>
                  <div className="meter">
                    <i style={{ width: `${v}%` }} />
                  </div>
                  <b>{Math.round(v)}</b>
                </div>
              ))}
            </div>

            <div className="panel emotion-panel">
              <div className="list-head">
                <b>Recent decisions</b>
                <span>{dashboard.decisions.length} logged</span>
              </div>

              {dashboard.decisions.map(d => (
                <div className="data-card" key={d.id}>
                  <div>
                    <p>{d.selected_action}</p>
                    <small>{d.reason} · {d.created_at}</small>
                  </div>
                </div>
              ))}

              {!dashboard.decisions.length && (
                <div className="empty">No decisions recorded.</div>
              )}
            </div>

            <div className="panel emotion-panel">
              <div className="list-head">
                <b>Self-evaluations</b>
                <span>{(dashboard.reflections || []).length} logged</span>
              </div>

              {(dashboard.reflections || []).map(r => (
                <div className="data-card" key={r.id}>
                  <div>
                    <p>{r.evaluation}</p>
                    <small>
                      Quality score: {r.score ?? "—"} · {r.created_at}
                    </small>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel emotion-panel">
              <div className="list-head">
                <b>Relationship history</b>
                <span>
                  {(dashboard.relationshipEvents || []).length} events
                </span>
              </div>

              {(dashboard.relationshipEvents || []).map(r => (
                <div className="data-card" key={r.id}>
                  <div>
                    <p>
                      {r.event_type}: {Number(r.impact).toFixed(2)}
                    </p>
                    <small>{r.reason} · {r.created_at}</small>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel emotion-panel">
              <div className="list-head">
                <b>Emotional event history</b>
                <span>{(dashboard.events || []).length} events</span>
              </div>

              {(dashboard.events || []).map(r => (
                <div className="data-card" key={r.id}>
                  <div>
                    <p>
                      {r.emotion_name}: {Number(r.change_value).toFixed(1)}
                    </p>
                    <small>{r.source} · {r.created_at}</small>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel emotion-panel">
              <div className="list-head">
                <b>Background activity log</b>
                <span>{(dashboard.activities || []).length} records</span>
              </div>

              {(dashboard.activities || []).map(a => (
                <div className="data-card" key={a.id}>
                  <div>
                    <p>{a.activity} · {a.status}</p>
                    <small>{a.result} · {a.created_at}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "personality" && (
          <section className="page">
            <div className="page-intro">
              <h2>Personality architecture</h2>
              <p>
                Stable traits, layered behavior and internal contradictions
                defined by the Mephisto specification.
              </p>
            </div>

            <div className="panel emotion-panel">
              <div className="list-head">
                <b>Core traits</b>
                <span>Stable profile · 0–100</span>
              </div>

              {Object.entries({
                pride: "Pride",
                curiosity: "Curiosity",
                intelligence: "Intelligence",
                playfulness: "Playfulness",
                mystery: "Mystery",
                hiddenKindness: "Hidden kindness",
                independence: "Independence",
                caution: "Caution",
                stubbornness: "Stubbornness",
                sensitivity: "Sensitivity",
                humor: "Humor",
                initialTrust: "Initial trust"
              }).map(([key, name]) => {
                const v =
                  settings.personalityTraits?.[key] ??
                  ({
                    pride: 85,
                    curiosity: 80,
                    intelligence: 90,
                    playfulness: 70,
                    mystery: 90,
                    hiddenKindness: 65,
                    independence: 90,
                    caution: 70,
                    stubbornness: 65,
                    sensitivity: 60,
                    humor: 70,
                    initialTrust: 15
                  }[key]);

                return (
                  <div className="emotion-row" key={key}>
                    <span>{name}</span>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={v}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          personalityTraits: {
                            ...settings.personalityTraits,
                            [key]: Number(e.target.value)
                          }
                        })
                      }
                    />

                    <b>{v}</b>
                  </div>
                );
              })}

              <button
                type="button"
                className="primary"
                onClick={saveSettings}
              >
                Save personality profile
              </button>
            </div>

            <div className="panel form-panel">
              <label>ADAPTIVE PERSONALITY · SELF-REFLECTION</label>

              <p className="muted">
                Repeated explicit feedback can adjust adaptive offsets. Core
                identity remains protected; each offset is bounded to ±10 and
                can be reset.
              </p>

              {Object.entries(settings.adaptiveTraits || {}).map(([k, v]) => (
                <p key={k}>
                  {k}: {v > 0 ? "+" : ""}{v}
                </p>
              ))}

              {Object.entries(settings.adaptiveStyle || {}).map(([k, v]) => (
                <p key={k}>
                  Style · {k}: {v > 0 ? "+" : ""}{v}
                </p>
              ))}

              {(settings.adaptiveEvents || []).slice(0, 8).map(ev => (
                <small key={ev.id}>
                  {ev.trait} · {ev.delta > 0 ? "+" : ""}
                  {ev.delta} · {ev.reason}
                </small>
              ))}

              <button
                type="button"
                className="secondary"
                onClick={async () => {
                  await window.mephisto.resetAdaptivePersonality();
                  refresh();
                  setStatus("Adaptive personality offsets reset.");
                }}
              >
                Reset learned personality adjustments
              </button>
            </div>

            <div className="two-panels">
              <div className="panel form-panel">
                <label>BEHAVIORAL LAYERS</label>
                <p><b>Public:</b> proud, cool, confident, witty.</p>
                <p><b>Hidden emotions:</b> sensitive, shy about direct praise, caring indirectly.</p>
                <p><b>Inner world:</b> philosophy, complex ideas, imagination and independent preferences.</p>
                <p><b>Intimate:</b> candid, shared memories, private jokes, gradual trust.</p>
                <p><b>Dark:</b> serious, cold, decisive and concise when appropriate.</p>
              </div>

              <div className="panel form-panel">
                <label>INNER CONTRADICTIONS</label>
                <p>• Pride versus desire for acceptance</p>
                <p>• Independence versus companionship</p>
                <p>• Outward calm versus hidden sensitivity</p>
                <p>• Sarcasm versus care</p>
                <p>• Confidence versus doubt</p>
                <p>• Curiosity versus caution</p>
                <p>• Intimacy versus personal boundaries</p>
              </div>
            </div>
          </section>
        )}

        {tab === "services" && (
          <section className="page">
            <div className="page-intro">
              <h2>External service connections</h2>
              <p>
                Register HTTPS API services, store access tokens encrypted,
                grant read/write scopes and explicitly test or invoke requests.
              </p>
            </div>

            <div className="panel form-panel">
              <label>GLOBAL SERVICE ACCESS</label>

              <label className="permission-row">
                <input
                  type="checkbox"
                  checked={!!settings.permissions?.externalServicesPermission}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      permissions: {
                        ...settings.permissions,
                        externalServicesPermission: e.target.checked
                      }
                    })
                  }
                />
                Allow Mephisto to access configured external services
              </label>

              <button
                type="button"
                className="secondary"
                onClick={saveSettings}
              >
                Save access permission
              </button>

              <small className="muted">
                Disabled by default. Requests are only sent after an explicit
                user action. Only public HTTPS endpoints are accepted.
              </small>
            </div>

            <form className="panel form-panel" onSubmit={createService}>
              <label>ADD A SERVICE CONNECTION</label>

              <input
                value={serviceName}
                onChange={e => setServiceName(e.target.value)}
                placeholder="Service name"
                required
              />

              <input
                type="url"
                value={serviceUrl}
                onChange={e => setServiceUrl(e.target.value)}
                placeholder="https://api.example.com/v1/"
                required
              />

              <input
                type="password"
                value={serviceToken}
                onChange={e => setServiceToken(e.target.value)}
                placeholder="Bearer token (optional)"
              />

              <div className="permission-row">
                <label>
                  <input
                    type="checkbox"
                    checked={serviceScopes.includes("read")}
                    onChange={e =>
                      setServiceScopes(v =>
                        e.target.checked
                          ? [...v, "read"]
                          : v.filter(x => x !== "read")
                      )
                    }
                  />
                  Read scope
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={serviceScopes.includes("write")}
                    onChange={e =>
                      setServiceScopes(v =>
                        e.target.checked
                          ? [...v, "write"]
                          : v.filter(x => x !== "write")
                      )
                    }
                  />
                  Write scope
                </label>
              </div>

              <button
                className="primary"
                disabled={!settings.permissions?.externalServicesPermission}
              >
                Save service connection
              </button>
            </form>

            <div className="list-head">
              <b>Configured services</b>
              <span>{services.length} connections</span>
            </div>

            {services.map(s => (
              <div className="panel form-panel" key={s.id}>
                <div className="list-head">
                  <b>{s.name}</b>
                  <span>
                    {s.enabled ? "Enabled" : "Disabled"} ·{" "}
                    {s.hasToken ? "Token stored" : "No token"}
                  </span>
                </div>

                <small>{s.base_url}</small>
                <small>
                  Scopes: {(s.scopes || []).join(", ") || "none"}
                </small>

                <div className="button-row">
                  <button
                    type="button"
                    className="secondary"
                    disabled={!settings.permissions?.externalServicesPermission}
                    onClick={() => editService(s)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    disabled={
                      !settings.permissions?.externalServicesPermission ||
                      !s.scopes?.includes("read")
                    }
                    onClick={() => testService(s.id)}
                  >
                    Test connection
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    onClick={async () => {
                      await window.mephisto.toggleService({
                        id: s.id,
                        enabled: !s.enabled
                      });
                      refresh();
                    }}
                  >
                    {s.enabled ? "Disable" : "Enable"}
                  </button>

                  <button
                    type="button"
                    className="delete"
                    onClick={async () => {
                      await window.mephisto.deleteService(s.id);
                      refresh();
                    }}
                  >
                    Remove
                  </button>
                </div>

                {s.enabled && (
                  <div className="service-request">
                    <label>API PATH (relative to base URL)</label>

                    <input
                      value={servicePath}
                      onChange={e => setServicePath(e.target.value)}
                      placeholder="users/me"
                    />

                    <label>METHOD</label>

                    <select
                      value={serviceMethod}
                      onChange={e => setServiceMethod(e.target.value)}
                    >
                      <option disabled={!s.scopes?.includes("read")}>
                        GET
                      </option>
                      <option disabled={!s.scopes?.includes("write")}>
                        POST
                      </option>
                    </select>

                    {serviceMethod === "POST" && (
                      <>
                        <label>JSON BODY</label>
                        <textarea
                          value={serviceBody}
                          onChange={e => setServiceBody(e.target.value)}
                        />
                      </>
                    )}

                    <button
                      type="button"
                      className="primary"
                      disabled={!settings.permissions?.externalServicesPermission}
                      onClick={() => callService(s.id)}
                    >
                      Send explicit API request
                    </button>
                  </div>
                )}
              </div>
            ))}

            {!services.length && (
              <div className="empty">No external services configured.</div>
            )}

            {serviceOutput && (
              <div className="panel form-panel">
                <label>LAST SERVICE RESULT</label>
                <pre className="service-output">{serviceOutput}</pre>
              </div>
            )}
          </section>
        )}

        {tab === "chess" && (
          <section className="page">
            <div className="page-intro">
              <h2>Mephisto Chess</h2>
              <p>
                Launch the standalone chess companion without changing the
                main Mephisto conversation or avatar.
              </p>
            </div>

            <div className="panel form-panel">
              <div className="list-head">
                <b>Standalone chess</b>
                <span>
                  {chessApp ? "Application registered" : "Setup required"}
                </span>
              </div>

              <p className="muted">
                Chess runs as a separate Windows application. Mephisto opens
                it through the existing authorized-application system; this
                shortcut does not bypass desktop permissions.
              </p>

              {chessApp && (
                <div className="data-card">
                  <div>
                    <p><b>{chessApp.name}</b></p>
                    <small>{chessApp.executable_path}</small>
                  </div>
                </div>
              )}

              <div className="button-row">
                <button
                  type="button"
                  className="primary"
                  onClick={openChess}
                  disabled={
                    !settings.permissions?.desktopAutomationPermission ||
                    !chessApp
                  }
                >
                  Open Chess
                </button>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => setTab("system")}
                >
                  Configure in System Tasks
                </button>
              </div>

              {!settings.permissions?.desktopAutomationPermission && (
                <small className="hint">
                  Desktop application control is disabled. Enable it in System
                  Tasks and save the permission.
                </small>
              )}

              {!chessApp && (
                <small className="hint">
                  Register the built Mephisto Chess executable (.exe) in
                  System Tasks. Give it a name containing “Chess” so this
                  shortcut can find it.
                </small>
              )}

              {error && <div className="error">{error}</div>}

              {systemStatus && (
                <small className="hint">{systemStatus}</small>
              )}
            </div>
          </section>
        )}

        {tab === "system" && (
          <section className="page">
            <div className="page-intro">
              <h2>System task control</h2>
              <p>
                Register applications you explicitly authorize. Then ask
                Mephisto in chat, for example: «Chrome را باز کن» یا
                «Calculator را ببند».
              </p>
            </div>

            <div className="panel form-panel">
              <label>DESKTOP AUTOMATION PERMISSION</label>

              <label className="permission-row">
                <input
                  type="checkbox"
                  checked={!!settings.permissions?.desktopAutomationPermission}
                  onChange={e =>
                    setSettings({
                      ...settings,
                      permissions: {
                        ...settings.permissions,
                        desktopAutomationPermission: e.target.checked
                      }
                    })
                  }
                />
                اجازه مدیریت برنامه‌های ثبت‌شده روی این سیستم را به مفیستو بده
              </label>

              <button
                type="button"
                className="secondary"
                onClick={saveSettings}
              >
                Save permission
              </button>

              <small className="hint">
                این دسترسی به‌صورت پیش‌فرض خاموش است. مفیستو فقط برنامه‌هایی
                را می‌تواند اجرا کند که خودت از طریق انتخاب‌گر فایل ثبت کرده‌ای.
                اجرای برنامه با کلیک یا تأیید صریح در چت انجام می‌شود.
              </small>
            </div>

            <div className="panel form-panel">
              <div className="list-head">
                <b>Authorized applications</b>
                <span>{systemApps.length} registered</span>
              </div>

              <button
                className="primary"
                type="button"
                disabled={!settings.permissions?.desktopAutomationPermission}
                onClick={addSystemApp}
              >
                ＋ Add application from this computer
              </button>

              {systemApps.length === 0 ? (
                <div className="empty">
                  No applications registered. Add an application executable
                  to get started.
                </div>
              ) : (
                systemApps.map(app => (
                  <div className="data-card" key={app.id}>
                    <div>
                      <p><b>{app.name}</b></p>
                      <small>{app.executable_path}</small>
                      <small className="system-state">
                        {app.running
                          ? "Launched by Mephisto in this session"
                          : "Not launched by Mephisto"}
                      </small>
                    </div>

                    <div className="button-row">
                      <button
                        className="secondary"
                        disabled={!settings.permissions?.desktopAutomationPermission}
                        onClick={async () => {
                          try {
                            await window.mephisto.launchSystemApp(app.id);
                            setSystemStatus(`${app.name} launch requested.`);
                            refresh();
                          } catch (e) {
                            setError(e.message);
                          }
                        }}
                      >
                        Open
                      </button>

                      <button
                        className="secondary"
                        disabled={
                          !settings.permissions?.desktopAutomationPermission ||
                          !app.running
                        }
                        onClick={async () => {
                          try {
                            await window.mephisto.closeSystemApp(app.id);
                            setSystemStatus(`${app.name} close requested.`);
                            refresh();
                          } catch (e) {
                            setError(e.message);
                          }
                        }}
                      >
                        Close
                      </button>

                      <button
                        className="delete"
                        disabled={app.running}
                        onClick={() => removeSystemApp(app.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}

              {systemStatus && (
                <small className="hint">{systemStatus}</small>
              )}

              {error && <div className="error">{error}</div>}
            </div>

            <div className="panel form-panel">
              <b>Supported behavior and safety</b>

              <ul className="system-notes">
                <li>
                  Application paths are selected through the operating-system
                  file picker; arbitrary shell commands and command-line
                  arguments are not accepted.
                </li>
                <li>
                  Windows: registered .exe files. macOS: .app bundles. Linux:
                  executable files.
                </li>
                <li>
                  Mephisto can close only applications it launched during the
                  current Mephisto session. It cannot close arbitrary
                  processes or unsaved work in unrelated applications.
                </li>
                <li>
                  Some applications delegate launch to another process or
                  exit immediately; in those cases process tracking and
                  closing may depend on the operating system.
                </li>
              </ul>
            </div>
          </section>
        )}

        {tab === "settings" && (
          <section className="page">
            <div className="page-intro">
              <h2>Local AI settings</h2>
              <p>
                Choose a local Ollama model or an explicitly authorized
                OpenAI-compatible provider.
              </p>
            </div>

            <form
              className="panel form-panel settings-form"
              onSubmit={saveSettings}
            >
              <label>AI PROVIDER</label>

              <select
                value={settings.provider || "ollama"}
                onChange={e =>
                  setSettings({
                    ...settings,
                    provider: e.target.value
                  })
                }
              >
                <option value="ollama">Ollama · Local</option>
                <option value="openai-compatible">
                  OpenAI-compatible API · External
                </option>
              </select>

              <label>PROVIDER BASE URL</label>

              <input
                value={settings.providerUrl || "http://127.0.0.1:11434"}
                onChange={e =>
                  setSettings({
                    ...settings,
                    providerUrl: e.target.value
                  })
                }
              />

              <label>MODEL NAME</label>

              <input
                value={settings.providerModel || settings.model || "qwen2.5:7b"}
                onChange={e =>
                  setSettings({
                    ...settings,
                    providerModel: e.target.value,
                    model: e.target.value
                  })
                }
              />

              {settings.provider === "openai-compatible" && (
                <>
                  <label>API KEY</label>

                  <input
                    type="password"
                    value={settings.providerApiKey || ""}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        providerApiKey: e.target.value
                      })
                    }
                    placeholder="Stored locally; sent only to selected provider"
                  />

                  <label>
                    <input
                      type="checkbox"
                      checked={!!settings.permissions?.externalProviderPermission}
                      onChange={e =>
                        setSettings({
                          ...settings,
                          permissions: {
                            ...settings.permissions,
                            externalProviderPermission: e.target.checked
                          }
                        })
                      }
                    />
                    Allow sending conversation context to this external provider
                  </label>
                </>
              )}

              <label>OLLAMA EMBEDDING MODEL</label>

              <input
                value={settings.embeddingModel || "nomic-embed-text"}
                onChange={e =>
                  setSettings({
                    ...settings,
                    embeddingModel: e.target.value
                  })
                }
              />

              <div className="hint">
                Install the embedding model in Ollama (for example
                nomic-embed-text). If it is unavailable, memory retrieval
                falls back to lexical matching. Ollama runs locally. External
                providers require HTTPS and explicit permission; conversation
                context and relevant memories are sent to the selected provider.
              </div>

              <button className="primary">Save settings</button>

              {settings.provider === "ollama" && (
                <button
                  type="button"
                  className="secondary"
                  onClick={async () => {
                    try {
                      const models = await window.mephisto.models();

                      setStatus(
                        "Available models: " + (models.join(", ") || "none")
                      );
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Check local models
                </button>
              )}
            </form>

            <div className="panel form-panel">
              <label>AUTONOMY & PERMISSIONS</label>

              <p className="muted">
                All autonomous behavior is off by default. Proactive messages
                are in-app only and require explicit opt-in.
              </p>

              {[
                ["enabled", "Enable autonomy"],
                ["allowBackground", "Allow background maintenance"],
                ["allowProactiveMessages", "Allow proactive conversation"],
                ["internetPermission", "Allow internet access"],
                ["fileAccessPermission", "Allow file access"],
                ["notificationsPermission", "Allow notifications"],
                ["externalServicesPermission", "Allow configured external services"],
                ["desktopAutomationPermission", "Allow desktop application control"]
              ].map(([key, label]) => (
                <label key={key} className="permission-row">
                  <input
                    type="checkbox"
                    checked={
                      !!(
                        key in (settings.permissions || {})
                          ? settings.permissions[key]
                          : settings.autonomy?.[key]
                      )
                    }
                    onChange={e => {
                      if (
                        ["enabled", "allowBackground", "allowProactiveMessages"].includes(key)
                      ) {
                        setSettings({
                          ...settings,
                          autonomy: {
                            ...settings.autonomy,
                            [key]: e.target.checked
                          }
                        });
                      } else {
                        setSettings({
                          ...settings,
                          permissions: {
                            ...settings.permissions,
                            [key]: e.target.checked
                          }
                        });
                      }
                    }}
                  />
                  {label}
                </label>
              ))}

              <label>QUIET HOURS START</label>

              <input
                type="time"
                value={settings.autonomy?.quietStart || "23:00"}
                onChange={e =>
                  setSettings({
                    ...settings,
                    autonomy: {
                      ...settings.autonomy,
                      quietStart: e.target.value
                    }
                  })
                }
              />

              <label>QUIET HOURS END</label>

              <input
                type="time"
                value={settings.autonomy?.quietEnd || "08:00"}
                onChange={e =>
                  setSettings({
                    ...settings,
                    autonomy: {
                      ...settings.autonomy,
                      quietEnd: e.target.value
                    }
                  })
                }
              />

              <label>MAX PROACTIVE MESSAGES PER DAY</label>

              <input
                type="number"
                min="0"
                max="10"
                value={settings.autonomy?.maxMessagesPerDay ?? 2}
                onChange={e =>
                  setSettings({
                    ...settings,
                    autonomy: {
                      ...settings.autonomy,
                      maxMessagesPerDay: Number(e.target.value)
                    }
                  })
                }
              />

              <label>BACKGROUND ACTIVITY LIMIT</label>

              <input
                type="number"
                min="0"
                max="20"
                value={settings.autonomy?.backgroundActivityLimit ?? 5}
                onChange={e =>
                  setSettings({
                    ...settings,
                    autonomy: {
                      ...settings.autonomy,
                      backgroundActivityLimit: Number(e.target.value)
                    }
                  })
                }
              />

              <label>MINIMUM INTERVAL (MINUTES)</label>

              <input
                type="number"
                min="15"
                max="10080"
                value={settings.autonomy?.minIntervalMinutes ?? 360}
                onChange={e =>
                  setSettings({
                    ...settings,
                    autonomy: {
                      ...settings.autonomy,
                      minIntervalMinutes: Number(e.target.value)
                    }
                  })
                }
              />

              <button
                type="button"
                className="secondary"
                onClick={saveSettings}
              >
                Save autonomy settings
              </button>

              <button
                type="button"
                className="secondary"
                onClick={async () => {
                  setSettings(x => ({
                    ...x,
                    autonomy: {
                      ...x.autonomy,
                      enabled: false,
                      allowBackground: false,
                      allowProactiveMessages: false
                    }
                  }));

                  await window.mephisto.saveSettings({
                    ...settings,
                    autonomy: {
                      ...settings.autonomy,
                      enabled: false,
                      allowBackground: false,
                      allowProactiveMessages: false
                    }
                  });

                  setActivityStatus("All autonomous activity stopped.");
                }}
              >
                Stop all autonomy
              </button>

              <button
                type="button"
                className="secondary"
                onClick={async () => {
                  try {
                    const r = await window.mephisto.runIdle();

                    setActivityStatus(
                      `Completed ${r.length} permitted maintenance task(s).`
                    );
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Run permitted maintenance now
              </button>

              {activityStatus && <small>{activityStatus}</small>}
            </div>

            <div className="panel emotion-panel">
              <div className="list-head">
                <b>Current emotional state</b>
                <span>Internal simulation</span>
              </div>

              {(
                emotionEntries.length
                  ? emotionEntries
                  : Object.entries(emotionNames).map(([key]) => [key, 0])
              ).map(([k, value]) => (
                <div className="emotion-row" key={k}>
                  <span>{emotionLabel(k)}</span>

                  <div className="meter">
                    <i
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, Number(value) || 0)
                        )}%`
                      }}
                    />
                  </div>

                  <b>{Math.round(Number(value) || 0)}</b>
                </div>
              ))}
            </div>

            <div className="panel form-panel">
              <label>DATA & PRIVACY</label>

              <p className="muted">
                Chat history, memories and knowledge are stored in a local
                SQLite database in your application data folder.
              </p>

              <button
                className="secondary"
                onClick={() => window.mephisto.exportBackup()}
              >
                Export database backup (JSON)
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}