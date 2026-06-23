/**
 * Global Console Logger Interceptor
 * Intercepts all default console.log, console.info, console.warn, and console.error calls
 * and converts them into standardized JSON objects when running in production.
 */
export function initGlobalLogger() {
  if (process.env.NODE_ENV !== "production") {
    return; // Maintain default console outputs in development environment
  }

  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  const formatJsonLog = (level: string, originalMethod: Function, ...args: any[]) => {
    const message = args
      .map(arg => {
        if (arg instanceof Error) {
          return `${arg.message}\n${arg.stack}`;
        }
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");

    const logObject = {
      time: new Date().toISOString(),
      level,
      message,
    };

    // Output to stdout/stderr in JSON format
    originalMethod(JSON.stringify(logObject));
  };

  console.log = (...args: any[]) => formatJsonLog("INFO", originalLog, ...args);
  console.info = (...args: any[]) => formatJsonLog("INFO", originalInfo, ...args);
  console.warn = (...args: any[]) => formatJsonLog("WARN", originalWarn, ...args);
  console.error = (...args: any[]) => formatJsonLog("ERROR", originalError, ...args);

  console.log("[Logger] Global structured JSON logger initialized for production.");
}
