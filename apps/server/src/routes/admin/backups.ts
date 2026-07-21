import "@fastify/swagger";
import { createHash } from "node:crypto";
import {
  mkdirSync, readdirSync, statSync, createReadStream,
  unlinkSync, existsSync, readFileSync, writeFileSync, copyFileSync, renameSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { requireRole, AuthError } from "@pos/core";

interface BackupMeta {
  id: string;
  filename: string;
  size: number;
  sha256: string;
  createdAt: number;
}

// Module-level in-memory registry, rehydrated from disk at startup
const registry: BackupMeta[] = [];
let backupsDir = "./backups";
let registryLoaded = false;

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

function loadRegistry(dir: string) {
  if (registryLoaded) return;
  registryLoaded = true;
  ensureDir(dir);
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".db"));
    for (const file of files) {
      const filePath = join(dir, file);
      const shaPath  = filePath + ".sha256";
      const metaPath = filePath + ".meta.json";
      if (!existsSync(shaPath)) continue;
      const sha256 = readFileSync(shaPath, "utf8").trim();
      let id: string = randomUUID();
      let createdAt = statSync(filePath).mtimeMs;
      if (existsSync(metaPath)) {
        try {
          const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Partial<BackupMeta>;
          if (meta.id) id = meta.id;
          if (meta.createdAt) createdAt = meta.createdAt;
        } catch { /* ignore */ }
      }
      registry.push({ id, filename: file, size: statSync(filePath).size, sha256, createdAt });
    }
    registry.sort((a, b) => b.createdAt - a.createdAt);
  } catch { /* empty dir is fine */ }
}

function computeSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk as Buffer));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/** Check the first 16 bytes for the SQLite magic string. */
function isSqliteFile(filePath: string): boolean {
  try {
    const fd = require("node:fs").openSync(filePath, "r");
    const buf = Buffer.alloc(16);
    require("node:fs").readSync(fd, buf, 0, 16, 0);
    require("node:fs").closeSync(fd);
    return buf.toString("ascii", 0, 16) === "SQLite format 3\x00";
  } catch {
    return false;
  }
}

/**
 * Replace the live database file with a backup, then schedule a clean exit so
 * the process manager (electron / PM2) restarts the server with the new DB.
 * We give the reply 200ms to flush before exiting.
 */
function scheduleRestart(dbPath: string, backupPath: string, logger: { info: (...a: unknown[]) => void }) {
  const pre = dbPath + ".pre-restore";
  try { copyFileSync(dbPath, pre); } catch { /* db may not exist yet */ }
  try {
    copyFileSync(backupPath, dbPath);
    logger.info({ dbPath, backupPath }, "Database replaced — restarting");
  } catch (err) {
    // Roll back if copy failed
    try { if (existsSync(pre)) copyFileSync(pre, dbPath); } catch { /* ignore */ }
    throw err;
  }
  setTimeout(() => process.exit(0), 300);
}

const backupsRoutes: FastifyPluginAsync = async (fastify) => {
  backupsDir = join(process.cwd(), "backups");
  loadRegistry(backupsDir);

  fastify.addHook("onRequest", async (request, reply) => {
    await fastify.authenticate(request);
    try {
      requireRole(request.session!, "admin");
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.status(403).send({ error: err.message });
      }
      throw err;
    }
  });

  // POST /api/admin/backups/create
  fastify.post("/admin/backups/create", {
    schema: { tags: ["backups"], summary: "Create a new database backup" },
  }, async (_request, reply) => {
    ensureDir(backupsDir);
    const id = randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `backup-${timestamp}.db`;
    const filePath = join(backupsDir, filename);
    const metaPath = filePath + ".meta.json";
    const shaPath  = filePath + ".sha256";

    // better-sqlite3 native backup — returns a Promise
    await fastify.ctx.sqlite.backup(filePath);

    const sha256 = await computeSha256(filePath);
    const size = statSync(filePath).size;

    writeFileSync(shaPath, sha256);
    const meta: BackupMeta = { id, filename, size, sha256, createdAt: Date.now() };
    writeFileSync(metaPath, JSON.stringify(meta));

    registry.unshift(meta);
    fastify.ctx.logger.info({ filename, size, sha256 }, "Backup created");

    return reply.status(201).send(meta);
  });

  // GET /api/admin/backups/list
  fastify.get("/admin/backups/list", {
    schema: { tags: ["backups"], summary: "List all backups" },
  }, async (_request, reply) => {
    return reply.send(registry);
  });

  // GET /api/admin/backups/download/:id
  fastify.get("/admin/backups/download/:id", {
    schema: { tags: ["backups"], summary: "Download a backup file" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const meta = registry.find((b) => b.id === id);
    if (!meta) return reply.status(404).send({ error: "Backup not found" });

    const filePath = join(backupsDir, meta.filename);
    if (!existsSync(filePath)) return reply.status(404).send({ error: "Backup file missing on disk" });

    void reply.header("Content-Disposition", `attachment; filename="${meta.filename}"`);
    void reply.header("Content-Type", "application/octet-stream");
    void reply.header("Content-Length", String(meta.size));
    return reply.send(createReadStream(filePath));
  });

  // POST /api/admin/backups/:id/restore  — restore a server-side backup
  fastify.post("/admin/backups/:id/restore", {
    schema: { tags: ["backups"], summary: "Restore the database from a server-side backup and restart" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const meta = registry.find((b) => b.id === id);
    if (!meta) return reply.status(404).send({ error: "Backup not found" });

    const backupPath = join(backupsDir, meta.filename);
    if (!existsSync(backupPath)) return reply.status(404).send({ error: "Backup file missing on disk" });

    const dbPath = resolve(fastify.ctx.config.databaseUrl);
    fastify.ctx.logger.info({ id, filename: meta.filename }, "Restore requested — replacing database");

    await reply.status(200).send({ message: "Restore in corso — il server si riavvierà a breve" });

    scheduleRestart(dbPath, backupPath, fastify.ctx.logger);
  });

  // POST /api/admin/backups/restore-upload  — upload an external .db and restore it
  fastify.post("/admin/backups/restore-upload", {
    schema: { tags: ["backups"], summary: "Upload an external backup .db file, register it, and restore" },
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "Nessun file caricato" });

    if (!data.filename.endsWith(".db")) {
      return reply.status(400).send({ error: "Il file deve avere estensione .db" });
    }

    ensureDir(backupsDir);

    // Stream to a temp path first so we can validate before replacing anything
    const tempPath = join(backupsDir, `upload-${randomUUID()}.tmp`);
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk as Buffer);
    const buf = Buffer.concat(chunks);
    writeFileSync(tempPath, buf);

    // Validate SQLite magic bytes
    if (!isSqliteFile(tempPath)) {
      try { unlinkSync(tempPath); } catch { /* ignore */ }
      return reply.status(400).send({ error: "Il file non è un database SQLite valido" });
    }

    // Register as a proper backup entry
    const id = randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `backup-imported-${timestamp}.db`;
    const filePath = join(backupsDir, filename);
    const metaPath = filePath + ".meta.json";
    const shaPath  = filePath + ".sha256";

    renameSync(tempPath, filePath);
    const sha256 = await computeSha256(filePath);
    const size = statSync(filePath).size;

    writeFileSync(shaPath, sha256);
    const meta: BackupMeta = { id, filename, size, sha256, createdAt: Date.now() };
    writeFileSync(metaPath, JSON.stringify(meta));
    registry.unshift(meta);

    const dbPath = resolve(fastify.ctx.config.databaseUrl);
    fastify.ctx.logger.info({ filename, size, sha256 }, "Backup imported and restore requested");

    await reply.status(200).send({ message: "Restore in corso — il server si riavvierà a breve", meta });

    scheduleRestart(dbPath, filePath, fastify.ctx.logger);
  });

  // DELETE /api/admin/backups/:id
  fastify.delete("/admin/backups/:id", {
    schema: { tags: ["backups"], summary: "Delete a backup" },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const idx = registry.findIndex((b) => b.id === id);
    if (idx === -1) return reply.status(404).send({ error: "Backup not found" });

    const [meta] = registry.splice(idx, 1);
    const filePath = join(backupsDir, meta!.filename);
    try { unlinkSync(filePath); } catch { /* already gone */ }
    try { unlinkSync(filePath + ".sha256"); } catch { /* ignore */ }
    try { unlinkSync(filePath + ".meta.json"); } catch { /* ignore */ }

    return reply.status(204).send();
  });
};

export default backupsRoutes;