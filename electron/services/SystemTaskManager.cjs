const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

class SystemTaskManager {
  constructor({ db, platform = process.platform, spawnImpl = spawn, killImpl = process.kill } = {}) {
    this.db = db;
    this.platform = platform;
    this.spawn = spawnImpl;
    this.kill = killImpl;
    this.running = new Map();
  }

  validateSelectedPath(inputPath) {
    if (typeof inputPath !== 'string' || !inputPath.trim()) throw new Error('Choose an application first.');
    const resolved = fs.realpathSync(inputPath);
    const stat = fs.statSync(resolved);
    if (this.platform === 'darwin') {
      if (!stat.isDirectory() || !resolved.toLowerCase().endsWith('.app') || !fs.existsSync(path.join(resolved, 'Contents', 'Info.plist'))) {
        throw new Error('On macOS, select a valid .app bundle.');
      }
    } else {
      if (!stat.isFile()) throw new Error('Select an application executable file.');
      if (this.platform === 'win32' && path.extname(resolved).toLowerCase() !== '.exe') throw new Error('Only .exe applications are supported on Windows.');
      if (this.platform !== 'win32' && (stat.mode & 0o111) === 0) throw new Error('The selected file is not executable.');
    }
    return resolved;
  }

  add({ name, executablePath }) {
    const cleanName = String(name || '').trim().slice(0, 80);
    if (!cleanName) throw new Error('Application name is required.');
    const safePath = this.validateSelectedPath(executablePath);
    const existing = this.db.prepare('SELECT id FROM managed_apps WHERE executable_path=?').get(safePath);
    if (existing) throw new Error('This application is already registered.');
    const result = this.db.prepare('INSERT INTO managed_apps(name,executable_path) VALUES(?,?)').run(cleanName, safePath);
    return Number(result.lastInsertRowid);
  }

  list() {
    if (this.platform !== 'darwin') {
      for (const [id, record] of this.running.entries()) {
        if (record.child && record.child.exitCode !== null) this.running.delete(id);
      }
    }
    return this.db.prepare('SELECT id,name,executable_path,created_at FROM managed_apps ORDER BY name COLLATE NOCASE').all()
      .map(app => ({ ...app, running: this.running.has(app.id) }));
  }

  async launch(id) {
    const app = this.db.prepare('SELECT * FROM managed_apps WHERE id=?').get(Number(id));
    if (!app) throw new Error('Registered application not found.');

    const active = this.running.get(app.id);
    if (active && (this.platform === 'darwin' || (active.child && active.child.exitCode === null && !active.child.killed))) {
      return { id: app.id, name: app.name, alreadyRunning: true, pid: active.pid || null };
    }

    // Revalidate the stored target at launch time. A registered path may have
    // been moved, deleted, or replaced since it was added.
    const executablePath = this.validateSelectedPath(app.executable_path);
    let command;
    let args;
    let options;

    if (this.platform === 'darwin') {
      command = '/usr/bin/open';
      args = ['-a', executablePath];
      options = { detached: true, stdio: 'ignore', shell: false };
    } else {
      command = executablePath;
      args = [];
      options = {
        cwd: path.dirname(executablePath),
        detached: true,
        stdio: 'ignore',
        shell: false,
        windowsHide: false
      };
    }

    let child;
    try {
      child = this.spawn(command, args, options);
    } catch (error) {
      throw new Error(`Windows could not start "${app.name}": ${error.message}`, { cause: error });
    }

    if (!child || typeof child.once !== 'function') {
      throw new Error('The operating system did not return a valid process handle.');
    }

    const record = {
      child,
      pid: null,
      appName: app.name,
      executablePath,
      startedAt: new Date().toISOString()
    };
    this.running.set(app.id, record);

    // Do not report success until Node confirms that the OS created the process.
    // A spawn error (for example ENOENT, EACCES or invalid executable format)
    // is now returned through IPC to the renderer instead of being swallowed.
    try {
      await new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
          child.removeListener?.('spawn', onSpawn);
          child.removeListener?.('error', onError);
        };
        const onSpawn = () => {
          if (settled) return;
          settled = true;
          record.pid = child.pid || null;
          cleanup();
          resolve();
        };
        const onError = error => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(error);
        };
        child.once('spawn', onSpawn);
        child.once('error', onError);
      });
    } catch (error) {
      this.running.delete(app.id);
      const code = error && error.code ? ` (${error.code})` : '';
      throw new Error(`Could not launch "${app.name}"${code}: ${error.message}`, { cause: error });
    }

    child.unref?.();
    return { id: app.id, name: app.name, started: true, pid: record.pid };
  }

  async close(id) {
    const app = this.db.prepare('SELECT * FROM managed_apps WHERE id=?').get(Number(id));
    if (!app) throw new Error('Registered application not found.');
    const record = this.running.get(app.id);

    // Windows GUI applications often outlive the detached process Electron
    // used to launch them. Do not use that launcher's PID. Locate the process
    // by the exact allowlisted executable path and verify its identity again
    // immediately before stopping it.
    if (this.platform === 'win32') {
      const targetBase64 = Buffer.from(app.executable_path, 'utf16le').toString('base64');
      const script = String.raw`$ErrorActionPreference = 'Stop'
try {
  $target = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${targetBase64}'))
  $target = [IO.Path]::GetFullPath($target)
  $matches = @(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop | Where-Object {
    $_.ExecutablePath -and [string]::Equals([IO.Path]::GetFullPath($_.ExecutablePath), $target, [StringComparison]::OrdinalIgnoreCase)
  })
  if ($matches.Count -eq 0) { Write-Output 'MEPHISTO_NO_MATCH'; exit 2 }
  $stopped = 0
  foreach ($item in $matches) {
    $filter = 'ProcessId = ' + [int]$item.ProcessId
    $current = Get-CimInstance -ClassName Win32_Process -Filter $filter -ErrorAction Stop
    if ($current -and $current.CreationDate -eq $item.CreationDate -and $current.ExecutablePath -and
        [string]::Equals([IO.Path]::GetFullPath($current.ExecutablePath), $target, [StringComparison]::OrdinalIgnoreCase)) {
      Stop-Process -Id ([int]$current.ProcessId) -Force -ErrorAction Stop
      $stopped++
    }
  }
  if ($stopped -eq 0) { Write-Output 'MEPHISTO_NO_SAFE_MATCH'; exit 3 }
  Write-Output ('MEPHISTO_CLOSED_COUNT=' + $stopped)
  exit 0
} catch {
  [Console]::Error.WriteLine(('MEPHISTO_POWERSHELL_ERROR: ' + $_.Exception.Message))
  exit 10
}`;
      const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
      const powershell = path.join(process.env.SystemRoot || 'C:\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const closer = this.spawn(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedScript], {
        stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true
      });
      const output = { stdout: '', stderr: '' };
      closer.stdout?.on('data', chunk => { output.stdout += chunk.toString(); });
      closer.stderr?.on('data', chunk => { output.stderr += chunk.toString(); });
      await new Promise((resolve, reject) => {
        let exitCode = null;
        let spawnError = null;
        closer.once('error', error => { spawnError = error; });
        // 'close' fires after stdout/stderr have fully drained; 'exit' can fire
        // earlier and lose the diagnostic text emitted by PowerShell.
        closer.once('exit', code => { exitCode = code; });
        closer.once('close', code => {
          if (spawnError) return reject(spawnError);
          const finalCode = code ?? exitCode;
          const stdout = output.stdout.trim();
          const stderr = output.stderr.trim();
          if (finalCode === 0) return resolve();
          if (finalCode === 2 || stdout.includes('MEPHISTO_NO_MATCH')) {
            return reject(new Error('The registered application is not currently running.'));
          }
          if (finalCode === 3 || stdout.includes('MEPHISTO_NO_SAFE_MATCH')) {
            return reject(new Error('The application changed during the safety check; no process was stopped. Try again.'));
          }
          const detail = (stderr || stdout).replace(/^MEPHISTO_POWERSHELL_ERROR:\s*/i, '').slice(0, 500);
          if (detail) return reject(new Error(`Windows could not close the application: ${detail}`));
          reject(new Error(`Windows could not safely close the application (PowerShell exit code ${finalCode ?? 'unknown'}). Check the registered executable path and Windows permissions.`));
        });
      });
      this.running.delete(app.id);
      return { id: app.id, name: app.name, closed: true };
    }

    if (!record) throw new Error('Mephisto can close this application only when it was launched during the current session.');
    if (this.platform !== 'darwin' && record.child && record.child.exitCode !== null) {
      this.running.delete(app.id);
      throw new Error('The application process has already exited; Mephisto cannot safely signal a reused process ID.');
    }

    if (this.platform === 'darwin') {
      const appLabel = path.basename(app.executable_path).replace(/\.app$/i, '');
      const script = 'on run argv\ntell application (item 1 of argv) to quit\nend run';
      const closer = this.spawn('/usr/bin/osascript', ['-e', script, appLabel], { stdio: 'ignore', shell: false });
      await new Promise((resolve, reject) => {
        closer.once('error', reject);
        closer.once('exit', code => code === 0 ? resolve() : reject(new Error('The application did not accept the close request.')));
      });
    } else if (record.pid) {
      this.kill(record.pid, 'SIGTERM');
    } else if (record.child && !record.child.killed) {
      record.child.kill('SIGTERM');
    }
    this.running.delete(app.id);
    return { id: app.id, name: app.name, closed: true };
  }

  remove(id) {
    if (this.running.has(Number(id))) throw new Error('Close the application before removing it.');
    return this.db.prepare('DELETE FROM managed_apps WHERE id=?').run(Number(id)).changes > 0;
  }
}

module.exports = SystemTaskManager;
