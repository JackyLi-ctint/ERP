export interface Config {
  bcryptRounds: number;
  rateLimitAuth: { max: number; windowMs: number };
  rateLimitApi: { max: number; windowMs: number };
  uploadMaxBytes: number;
  bodyLimit: string;
  pagination: { defaultSize: number; maxSize: number };
  corsOrigins: string[];
  azureStateTtlMs: number;
}

function parseEnvInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseEnvString(value: string | undefined, defaultValue: string): string {
  return value || defaultValue;
}

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value) {
    return ['http://localhost:5173'];
  }
  return value.split(',').map(origin => origin.trim());
}

const config: Config = {
  bcryptRounds: parseEnvInt(process.env.BCRYPT_ROUNDS, 12),
  rateLimitAuth: {
    max: parseEnvInt(process.env.RATE_LIMIT_AUTH_MAX, 10),
    windowMs: parseEnvInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 900000),
  },
  rateLimitApi: {
    max: parseEnvInt(process.env.RATE_LIMIT_API_MAX, 200),
    windowMs: parseEnvInt(process.env.RATE_LIMIT_API_WINDOW_MS, 60000),
  },
  uploadMaxBytes: parseEnvInt(process.env.UPLOAD_MAX_BYTES, 1048576),
  bodyLimit: parseEnvString(process.env.BODY_LIMIT, '10mb'),
  pagination: {
    defaultSize: parseEnvInt(process.env.PAGINATION_DEFAULT_SIZE, 20),
    maxSize: parseEnvInt(process.env.PAGINATION_MAX_SIZE, 100),
  },
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  azureStateTtlMs: parseEnvInt(process.env.AZURE_STATE_TTL_MS, 600000),
};

export default config;
