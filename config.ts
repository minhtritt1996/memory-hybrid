import { homedir } from "node:os";
import { join } from "node:path";
export const DECAY_CLASSES = [
  "permanent",
  "stable",
  "active",
  "session",
  "checkpoint",
] as const;
export type DecayClass = (typeof DECAY_CLASSES)[number];
/** TTL defaults in seconds per decay class. null = never expires. */
export const TTL_DEFAULTS: Record<DecayClass, number | null> = {
  permanent: null,
  stable: 90 * 24 * 3600, // 90 days
  active: 14 * 24 * 3600, // 14 days
  session: 24 * 3600, // 24 hours
  checkpoint: 4 * 3600, // 4 hours
};

export type HybridMemoryConfig = {
  embedding: {
    provider: "openai";
    model: string;
    apiKey: string; // empty string disables embeddings/vector DB
  };
  lanceDbPath: string;
  sqlitePath: string;
  autoCapture: boolean;
  autoRecall: boolean;
  // Optional lightweight LLM re-ranker (used when embeddings disabled)
  llmBaseUrl?: string;
  llmApiKey?: string;
  llmModel?: string;
};

export const MEMORY_CATEGORIES = [
  "preference",
  "fact",
  "decision",
  "entity",
  "other",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];
const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_LANCE_PATH = join(homedir(), ".openclaw", "memory", "lancedb");
const DEFAULT_SQLITE_PATH = join(homedir(), ".openclaw", "memory", "facts.db");
const EMBEDDING_DIMENSIONS: Record<string, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
};
export function vectorDimsForModel(model: string): number {
  const dims = EMBEDDING_DIMENSIONS[model];
  if (!dims) throw new Error(`Unsupported embedding model: ${model}`);
  return dims;
}
function resolveEnvVars(value: string): string {
  // Replace ${VAR} with the environment value if set; otherwise use empty string.
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    const envValue = process.env[envVar];
    return envValue || "";
  });
}
export const hybridConfigSchema = {
  parse(value: unknown): HybridMemoryConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("memory-hybrid config required");
    }
    const cfg = value as Record<string, unknown>;
    const embedding = cfg.embedding as Record<string, unknown> | undefined;
    // embedding.apiKey is optional; empty string disables vectors/embeddings
    const rawApiKey = embedding && typeof embedding.apiKey === "string" ? embedding.apiKey : "";
    const apiKey = rawApiKey.includes("${") ? resolveEnvVars(rawApiKey) : rawApiKey;
    const model = typeof embedding?.model === "string" ? (embedding!.model as string) : DEFAULT_MODEL;
    // Only validate vector dims if an apiKey is provided (embeddings enabled)
    if (apiKey && model) {
      vectorDimsForModel(model);
    }

    return {
      embedding: {
        provider: "openai",
        model,
        apiKey,
      },
      lanceDbPath: typeof cfg.lanceDbPath === "string" ? cfg.lanceDbPath : DEFAULT_LANCE_PATH,
      sqlitePath: typeof cfg.sqlitePath === "string" ? cfg.sqlitePath : DEFAULT_SQLITE_PATH,
      autoCapture: cfg.autoCapture !== false,
      autoRecall: cfg.autoRecall !== false,
      llmBaseUrl: typeof cfg.llmBaseUrl === "string" ? cfg.llmBaseUrl : undefined,
      llmApiKey: typeof cfg.llmApiKey === "string" ? (cfg.llmApiKey.includes("${") ? resolveEnvVars(cfg.llmApiKey) : cfg.llmApiKey) : undefined,
      llmModel: typeof cfg.llmModel === "string" ? cfg.llmModel : undefined,
    } as HybridMemoryConfig;
  },
};
