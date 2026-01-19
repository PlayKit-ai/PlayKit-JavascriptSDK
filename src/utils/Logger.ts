/**
 * PlayKit SDK Logger Module
 *
 * Provides a configurable logging system that allows:
 * - Controlling whether logs are sent to console
 * - Configuring where logs are sent
 * - Allowing external packages to hook into PlayKit logs
 * - Ensuring PlayKit output doesn't go directly to console
 */

/**
 * Log level enumeration
 * Lower values = higher priority
 */
export enum LogLevel {
  /** Disable all logging */
  NONE = 0,
  /** Error level - only errors */
  ERROR = 1,
  /** Warn level - warnings and errors */
  WARN = 2,
  /** Info level - info, warnings, and errors */
  INFO = 3,
  /** Debug level - all logs */
  DEBUG = 4,
}

/**
 * Log entry interface
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log level name */
  levelName: 'debug' | 'info' | 'warn' | 'error';
  /** Module/source identifier */
  source: string;
  /** Log message */
  message: string;
  /** Additional data */
  data?: unknown[];
  /** Timestamp */
  timestamp: Date;
}

/**
 * Log handler interface
 * External code can implement this interface to customize log handling
 */
export interface LogHandler {
  /**
   * Handle a log entry
   * @param entry The log entry to handle
   */
  handle(entry: LogEntry): void;
}

/**
 * Log configuration options
 */
export interface LogConfig {
  /**
   * Log level
   * @default LogLevel.WARN
   */
  level?: LogLevel;

  /**
   * Whether to enable console output
   * @default true
   */
  consoleEnabled?: boolean;

  /**
   * Custom log handlers
   */
  handlers?: LogHandler[];
}

/**
 * PlayKit Logger
 *
 * Features:
 * - Multiple log levels (debug, info, warn, error)
 * - Configurable log output destinations
 * - Allows external code to register handlers to receive logs
 * - Can completely disable console output
 *
 * @example
 * ```typescript
 * import { Logger, LogLevel } from 'playkit-sdk';
 *
 * // Get a logger for your module
 * const logger = Logger.getLogger('MyModule');
 *
 * // Log messages
 * logger.debug('Debug message');
 * logger.info('Info message');
 * logger.warn('Warning message');
 * logger.error('Error message', error);
 * ```
 */
export class Logger {
  private static globalLevel: LogLevel = LogLevel.WARN;
  private static handlers: LogHandler[] = [];
  private static consoleEnabled: boolean = true;
  private static instances: Map<string, Logger> = new Map();

  private source: string;
  private localLevel?: LogLevel;

  private constructor(source: string) {
    this.source = source;
  }

  // ===== Static configuration methods =====

  /**
   * Get or create a Logger instance for the specified source
   * @param source The source/module identifier
   * @returns Logger instance
   */
  static getLogger(source: string): Logger {
    if (!Logger.instances.has(source)) {
      Logger.instances.set(source, new Logger(source));
    }
    return Logger.instances.get(source)!;
  }

  /**
   * Set the global log level
   * @param level The log level to set
   */
  static setGlobalLevel(level: LogLevel): void {
    Logger.globalLevel = level;
  }

  /**
   * Get the current global log level
   * @returns The current global log level
   */
  static getGlobalLevel(): LogLevel {
    return Logger.globalLevel;
  }

  /**
   * Enable or disable console output
   * @param enabled Whether to enable console output
   */
  static setConsoleEnabled(enabled: boolean): void {
    Logger.consoleEnabled = enabled;
  }

  /**
   * Check if console output is enabled
   * @returns Whether console output is enabled
   */
  static isConsoleEnabled(): boolean {
    return Logger.consoleEnabled;
  }

  /**
   * Add a log handler
   * @param handler The handler to add
   */
  static addHandler(handler: LogHandler): void {
    if (!Logger.handlers.includes(handler)) {
      Logger.handlers.push(handler);
    }
  }

  /**
   * Remove a log handler
   * @param handler The handler to remove
   * @returns Whether the handler was found and removed
   */
  static removeHandler(handler: LogHandler): boolean {
    const index = Logger.handlers.indexOf(handler);
    if (index !== -1) {
      Logger.handlers.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all log handlers
   */
  static clearHandlers(): void {
    Logger.handlers = [];
  }

  /**
   * Get all registered handlers
   * @returns Array of registered handlers
   */
  static getHandlers(): readonly LogHandler[] {
    return Logger.handlers;
  }

  /**
   * Configure the logging system (convenience method)
   * @param config Log configuration
   */
  static configure(config: LogConfig): void {
    if (config.level !== undefined) {
      Logger.setGlobalLevel(config.level);
    }
    if (config.consoleEnabled !== undefined) {
      Logger.setConsoleEnabled(config.consoleEnabled);
    }
    if (config.handlers) {
      Logger.clearHandlers();
      config.handlers.forEach((h) => Logger.addHandler(h));
    }
  }

  /**
   * Reset the logger to default state
   * Useful for testing
   */
  static reset(): void {
    Logger.globalLevel = LogLevel.WARN;
    Logger.consoleEnabled = true;
    Logger.handlers = [];
    Logger.instances.clear();
  }

  // ===== Instance methods =====

  /**
   * Set the log level for this Logger instance
   * Set to undefined to use the global level
   * @param level The log level or undefined
   */
  setLevel(level: LogLevel | undefined): void {
    this.localLevel = level;
  }

  /**
   * Get the effective log level for this Logger
   * @returns The effective log level
   */
  getEffectiveLevel(): LogLevel {
    return this.localLevel ?? Logger.globalLevel;
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param data Additional data to log
   */
  debug(message: string, ...data: unknown[]): void {
    this.log(LogLevel.DEBUG, 'debug', message, data);
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param data Additional data to log
   */
  info(message: string, ...data: unknown[]): void {
    this.log(LogLevel.INFO, 'info', message, data);
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Additional data to log
   */
  warn(message: string, ...data: unknown[]): void {
    this.log(LogLevel.WARN, 'warn', message, data);
  }

  /**
   * Log an error message
   * @param message The message to log
   * @param data Additional data to log
   */
  error(message: string, ...data: unknown[]): void {
    this.log(LogLevel.ERROR, 'error', message, data);
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    levelName: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data: unknown[]
  ): void {
    const effectiveLevel = this.getEffectiveLevel();

    // Check log level
    if (level > effectiveLevel) {
      return;
    }

    const entry: LogEntry = {
      level,
      levelName,
      source: this.source,
      message,
      data: data.length > 0 ? data : undefined,
      timestamp: new Date(),
    };

    // Output to console
    if (Logger.consoleEnabled) {
      this.logToConsole(entry);
    }

    // Call all handlers
    for (const handler of Logger.handlers) {
      try {
        handler.handle(entry);
      } catch (e) {
        // Prevent handler errors from affecting the logging system
        if (Logger.consoleEnabled) {
          console.error('[Logger] Handler error:', e);
        }
      }
    }
  }

  /**
   * Output to console
   */
  private logToConsole(entry: LogEntry): void {
    const prefix = `[${entry.source}]`;
    const args = entry.data ? [prefix, entry.message, ...entry.data] : [prefix, entry.message];

    switch (entry.levelName) {
      case 'debug':
        console.log(...args);
        break;
      case 'info':
        console.info(...args);
        break;
      case 'warn':
        console.warn(...args);
        break;
      case 'error':
        console.error(...args);
        break;
    }
  }
}

/**
 * Buffer log handler
 * Stores logs in memory for later retrieval
 */
export class BufferLogHandler implements LogHandler {
  private buffer: LogEntry[] = [];
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  handle(entry: LogEntry): void {
    this.buffer.push(entry);

    // Remove oldest logs when exceeding max size
    while (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  /**
   * Get all buffered logs
   * @returns Array of log entries
   */
  getEntries(): readonly LogEntry[] {
    return this.buffer;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Get logs by level
   * @param level The log level to filter by
   * @returns Array of matching log entries
   */
  getEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.buffer.filter((e) => e.level === level);
  }

  /**
   * Get logs by source
   * @param source The source to filter by
   * @returns Array of matching log entries
   */
  getEntriesBySource(source: string): LogEntry[] {
    return this.buffer.filter((e) => e.source === source);
  }
}

/**
 * Callback log handler
 * Allows handling logs via a callback function
 */
export class CallbackLogHandler implements LogHandler {
  private callback: (entry: LogEntry) => void;

  constructor(callback: (entry: LogEntry) => void) {
    this.callback = callback;
  }

  handle(entry: LogEntry): void {
    this.callback(entry);
  }
}
