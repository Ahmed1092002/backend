type LogFields = Record<string, unknown>;
type LogLevel = "info" | "warn" | "error";

function normalize(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  return value;
}

function write(level: LogLevel, message: string, fields: LogFields = {}) {
  // One JSON object per line is easy to search locally and is understood by
  // Docker, cloud log collectors, and monitoring tools later.
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, normalize(value)]),
    ),
  };

  console[level](JSON.stringify(entry));
}

export const logger = {
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
