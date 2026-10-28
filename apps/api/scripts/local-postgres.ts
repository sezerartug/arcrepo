import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Development and test only: real PostgreSQL binaries (from the embedded-postgres packages)
// driven through initdb/pg_ctl, so no Docker is needed. Never used in production.

export interface LocalPostgresOptions {
  dataDir: string;
  port: number;
  user: string;
  password: string;
  // false for throwaway test clusters: skips fsync, which takes minutes on a scanned HDD.
  durable: boolean;
}

export interface LocalPostgres {
  url(database: string): string;
  stop(): Promise<void>;
}

// ICU tr-TR gives correct Turkish casing and ordering (İ/ı). `--locale=C` keeps initdb away from
// the non-ASCII Windows locale name ("Turkish_Türkiye.1254"), which it rejects.
const INITDB_FLAGS = ['--encoding=UTF8', '--locale=C', '--locale-provider=icu', '--icu-locale=tr-TR'];
const SERVER_OPTIONS = '-c timezone=UTC -c log_timezone=UTC -c listen_addresses=127.0.0.1';
const NON_DURABLE_OPTIONS = '-c fsync=off -c synchronous_commit=off -c full_page_writes=off';

interface Binaries {
  initdb: string;
  pg_ctl: string;
}

async function binaries(): Promise<Binaries> {
  // The platform package is a dependency of embedded-postgres, so resolve it from there.
  const require = createRequire(import.meta.url);
  const fromEmbedded = createRequire(require.resolve('embedded-postgres'));
  const os = process.platform === 'win32' ? 'windows' : process.platform;
  const entry = fromEmbedded.resolve(`@embedded-postgres/${os}-${process.arch}`);
  return (await import(pathToFileURL(entry).href)) as Binaries;
}

// stdio is ignored on purpose: the postmaster started by pg_ctl would inherit pipes and keep
// them open. Failures surface through the exit code and the server log.
function run(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code) => {
      resolve(code ?? 1);
    });
  });
}

async function ensureCluster(bin: Binaries, options: LocalPostgresOptions): Promise<void> {
  if (existsSync(join(options.dataDir, 'PG_VERSION'))) return;

  mkdirSync(options.dataDir, { recursive: true });
  const pwfile = join(tmpdir(), `arc-pg-pw-${String(process.pid)}`);
  writeFileSync(pwfile, options.password, { mode: 0o600 });
  try {
    const code = await run(bin.initdb, [
      '-D',
      options.dataDir,
      '-U',
      options.user,
      `--pwfile=${pwfile}`,
      '--auth=scram-sha-256',
      ...INITDB_FLAGS,
    ]);
    if (code !== 0) throw new Error(`initdb failed with exit code ${String(code)}`);
  } finally {
    rmSync(pwfile, { force: true });
  }
}

// Restarts a server left behind by a killed run, so start() always applies these options.
export async function startLocalPostgres(options: LocalPostgresOptions): Promise<LocalPostgres> {
  const bin = await binaries();
  await ensureCluster(bin, options);
  const server = handle(bin, options);
  if (existsSync(join(options.dataDir, 'postmaster.pid'))) await server.stop();

  const log = join(options.dataDir, 'server.log');
  const serverOptions = options.durable ? SERVER_OPTIONS : `${SERVER_OPTIONS} ${NON_DURABLE_OPTIONS}`;
  const code = await run(bin.pg_ctl, [
    'start',
    '-w',
    '-t',
    '120',
    '-D',
    options.dataDir,
    '-l',
    log,
    '-o',
    `-p ${String(options.port)} ${serverOptions}`,
  ]);
  if (code !== 0) throw new Error(`pg_ctl start failed with exit code ${String(code)}; see ${log}`);
  return server;
}

// Stops a running server without starting one; a no-op when none is running.
export async function stopLocalPostgres(dataDir: string): Promise<void> {
  if (!existsSync(join(dataDir, 'postmaster.pid'))) return;
  await run((await binaries()).pg_ctl, ['stop', '-m', 'fast', '-D', dataDir]);
}

function handle(bin: Binaries, options: LocalPostgresOptions): LocalPostgres {
  const base = `postgres://${options.user}:${encodeURIComponent(options.password)}@127.0.0.1:${String(options.port)}`;
  return {
    url: (database) => `${base}/${database}`,
    stop: async () => {
      await run(bin.pg_ctl, ['stop', '-m', 'fast', '-D', options.dataDir]);
    },
  };
}
