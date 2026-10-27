const NODE_ENVS = ['development', 'test', 'production'] as const;

export type NodeEnv = (typeof NODE_ENVS)[number];

export interface Env {
  readonly nodeEnv: NodeEnv;
  readonly port: number;
}

export class EnvError extends Error {
  override readonly name = 'EnvError';
}

const isNodeEnv = (value: string): value is NodeEnv =>
  (NODE_ENVS as readonly string[]).includes(value);

// Messages name the variable but never echo its value: values may be secrets.
export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
  const problems: string[] = [];

  const nodeEnv = source.NODE_ENV ?? 'development';
  if (!isNodeEnv(nodeEnv)) problems.push(`NODE_ENV must be one of: ${NODE_ENVS.join(', ')}`);

  const rawPort = source.PORT ?? '3001';
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || port < 1 || port > 65535) {
    problems.push('PORT must be an integer between 1 and 65535');
  }

  if (problems.length > 0 || !isNodeEnv(nodeEnv)) {
    throw new EnvError(`Invalid environment: ${problems.join('; ')}`);
  }
  return { nodeEnv, port };
}

// Existing process variables win over the file (Node's loadEnvFile semantics).
export function loadEnvFileIfExists(path: URL): void {
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
