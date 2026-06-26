import { Router } from "express";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);
const router = Router();

// server/ → one level up = repo root
const ROOT_DIR = path.join(process.cwd(), "..");

let _updating = false;

async function git(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: ROOT_DIR, timeout: 20_000 });
  return stdout.trim();
}

// GET /api/update/check
// Fetches latest remote state and compares with local HEAD.
router.get("/check", async (_req, res) => {
  try {
    await git(["fetch", "origin", "main"]);

    const [localHash, remoteHash] = await Promise.all([
      git(["rev-parse", "HEAD"]),
      git(["rev-parse", "origin/main"]),
    ]);

    if (localHash === remoteHash) {
      return res.json({ upToDate: true, localHash: localHash.slice(0, 7) });
    }

    const [remoteDate, remoteMessage, countStr] = await Promise.all([
      git(["log", "origin/main", "-1", "--format=%ci"]),
      git(["log", "origin/main", "-1", "--format=%s"]),
      git(["rev-list", "--count", `${localHash}..origin/main`]),
    ]);

    return res.json({
      upToDate: false,
      localHash:     localHash.slice(0, 7),
      remoteHash:    remoteHash.slice(0, 7),
      remoteDate,
      remoteMessage,
      commitCount:   Number(countStr),
    });
  } catch (err: any) {
    // Network unreachable, git not found, etc.
    res.status(500).json({ error: String(err.message ?? err) });
  }
});

// POST /api/update/install
// Runs git pull (+ npm install if package.json changed). Streams progress as SSE.
router.post("/install", (req, res) => {
  if (_updating) {
    return res.status(409).json({ error: "Update already in progress" });
  }
  _updating = true;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (line: string) => {
    if (!line.trim()) return;
    res.write(`data: ${JSON.stringify(line)}\n\n`);
  };
  const finish = (ok: boolean, msg: string) => {
    res.write(`event: ${ok ? "done" : "error"}\ndata: ${JSON.stringify(msg)}\n\n`);
    res.end();
    _updating = false;
  };

  const spawnLines = (cmd: string, args: string[], cwd: string) =>
    new Promise<void>((resolve, reject) => {
      const proc = spawn(cmd, args, { cwd });
      const onData = (d: Buffer) =>
        d.toString().split("\n").forEach(send);
      proc.stdout.on("data", onData);
      proc.stderr.on("data", onData);
      proc.on("close", (code) =>
        code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`))
      );
      proc.on("error", reject);
    });

  (async () => {
    try {
      // Determine whether package.json will change before pulling
      let pkgChanged = false;
      try {
        const diff = await git(["diff", "HEAD", "origin/main", "--name-only"]);
        pkgChanged = diff.split("\n").some(f => f.trim() === "server/package.json");
      } catch { /* non-fatal */ }

      send("→ git pull origin main");
      await spawnLines("git", ["pull", "origin", "main"], ROOT_DIR);

      if (pkgChanged) {
        send("→ npm install (package.json geändert)");
        await spawnLines("npm", ["install"], path.join(ROOT_DIR, "server"));
      }

      send("✓ Update abgeschlossen.");
      finish(true, "Update erfolgreich installiert.");
    } catch (err: any) {
      send(`✗ Fehler: ${String(err.message ?? err)}`);
      finish(false, String(err.message ?? err));
    }
  })();
});

// POST /api/update/restart
// Spawns a detached restart script, then gracefully shuts down this process.
router.post("/restart", (_req, res) => {
  res.json({ ok: true });
  const restartScript = path.join(ROOT_DIR, "scripts", "restart.sh");
  const child = spawn("bash", [restartScript], {
    detached: true,
    stdio:    "ignore",
    cwd:      ROOT_DIR,
  });
  child.unref();
  // Give the response time to arrive before exiting
  setTimeout(() => process.emit("SIGTERM" as any), 600);
});

export default router;
