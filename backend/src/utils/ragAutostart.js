// Brings up the Python RAG microservice (/rag-service, port 8100) when the
// backend starts, so "Tempu Rag isn't reachable" stops being a thing you have to
// remember to prevent. The agentic AI ("Tempu Ai") needs nothing here — it runs
// in this process; only RAG is a separate service.
//
// Two behaviours worth knowing about:
//
//   1. REUSE, don't restart. If :8100 already answers /health we leave it alone.
//   2. DETACHED child. `npm start` runs nodemon, which restarts this process on
//      every file save — a normal child would be killed and respawned each time,
//      reloading Chroma on every edit. Detached + unref'd means uvicorn starts
//      once and survives backend restarts; the next boot finds it healthy (1)
//      and skips. Trade-off: it outlives the backend, so Ctrl-C here does not
//      stop it. Stop it with the kill command logged at startup.
//
// Never throws and never blocks server startup: a RAG service that won't come up
// must not stop the backend from serving everything else.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..'); // backend/src/utils -> repo root
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

// Candidate interpreters, in order. rag-service/ has no venv of its own on this
// machine — it borrows the BOT project's — but a local .venv (README option C)
// wins if someone made one, and RAG_PYTHON overrides everything.
function resolvePython(dir) {
    const candidates = [
        process.env.RAG_PYTHON,
        path.join(dir, '.venv', 'bin', 'python'),
        '/home/arbin/Arbeen/Development/BOT/BOT/.venv/bin/python',
    ].filter(Boolean);
    return candidates.find((p) => fs.existsSync(p)) || null;
}

async function isUp(baseUrl, timeoutMs = 1500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
        return res.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

// Poll after spawning so the log says whether it actually came up, rather than
// just "spawned" — uvicorn can still die on an import error after fork.
async function waitUntilUp(baseUrl, attempts = 30) {
    for (let i = 0; i < attempts; i += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        if (await isUp(baseUrl)) return true;
    }
    return false;
}

function skipReason(baseUrl) {
    const flag = String(process.env.RAG_AUTOSTART || '').toLowerCase();
    if (flag === 'false' || flag === '0') return 'RAG_AUTOSTART=false';

    // In production the service is expected to be managed properly (systemd, its
    // own container) — spawning a stray detached process there would be wrong.
    const forced = flag === 'true' || flag === '1';
    if (process.env.NODE_ENV === 'production' && !forced) {
        return 'NODE_ENV=production (set RAG_AUTOSTART=true to override)';
    }

    // Only ever spawn something we could actually be responsible for: a remote
    // RAG_SERVICE_URL means someone else runs it.
    let hostname;
    try {
        ({ hostname } = new URL(baseUrl));
    } catch {
        return `RAG_SERVICE_URL is not a valid URL: ${baseUrl}`;
    }
    if (!LOCAL_HOSTS.has(hostname)) return `RAG service is remote (${hostname})`;

    return null;
}

export async function ensureRagService() {
    const baseUrl = (process.env.RAG_SERVICE_URL || 'http://localhost:8100').replace(/\/+$/, '');

    try {
        const skip = skipReason(baseUrl);
        if (skip) {
            console.log(`[rag] autostart skipped — ${skip}`);
            return;
        }

        if (await isUp(baseUrl)) {
            console.log(`[rag] already running at ${baseUrl} — reusing it`);
            return;
        }

        const dir = process.env.RAG_SERVICE_DIR || path.join(REPO_ROOT, 'rag-service');
        if (!fs.existsSync(path.join(dir, 'main.py'))) {
            console.warn(`[rag] autostart skipped — no main.py in ${dir}`);
            return;
        }

        const python = resolvePython(dir);
        if (!python) {
            console.warn(
                '[rag] autostart skipped — no Python interpreter found. Set RAG_PYTHON, ' +
                    'or see rag-service/README.md to create a venv.',
            );
            return;
        }

        const port = new URL(baseUrl).port || '8100';
        const logPath = path.join(dir, 'rag-service.log');
        const out = fs.openSync(logPath, 'a');

        const child = spawn(
            python,
            ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', port],
            { cwd: dir, detached: true, stdio: ['ignore', out, out] },
        );

        child.on('error', (err) => {
            console.error(`[rag] failed to spawn: ${err.message}`);
        });

        // Let the backend exit without waiting on (or killing) this child.
        child.unref();

        // Best-effort stop handle; the process is detached so Ctrl-C won't get it.
        const pidPath = path.join(dir, '.rag.pid');
        try {
            fs.writeFileSync(pidPath, String(child.pid));
        } catch {
            /* non-fatal: pidfile is a convenience, not a requirement */
        }

        console.log(`[rag] starting on port ${port} (pid ${child.pid}) — log: ${logPath}`);
        console.log(`[rag] it keeps running after this backend stops; kill it with: kill ${child.pid}`);

        if (await waitUntilUp(baseUrl)) {
            console.log(`[rag] ready at ${baseUrl}`);
        } else {
            console.error(
                `[rag] did not become healthy within 30s — check ${logPath}. ` +
                    'Ollama must also be running (embeddings are local).',
            );
        }
    } catch (err) {
        // Autostart is a convenience; never let it take the backend down.
        console.error(`[rag] autostart error (backend unaffected): ${err.message}`);
    }
}

export default ensureRagService;
