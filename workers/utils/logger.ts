/**
 * Queue Processing Logger
 *
 * Provides consistent, context-rich logging for queue message processing.
 * Helps debug failures by including projectId, userId, retry attempts, and stack traces.
 */

export interface LogContext {
  type?: string;
  projectId?: string;
  userId?: string;
  attempt?: number;
  [key: string]: any;
}

/**
 * Format a log message with context
 */
function formatLog(level: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const type = context?.type ? `[${context.type.toUpperCase()}]` : '[QUEUE]';

  let log = `${timestamp} ${type} ${level}: ${message}`;

  if (context) {
    const { type: _, ...rest } = context;
    const contextStr = Object.entries(rest)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${formatValue(value)}`)
      .join(', ');

    if (contextStr) {
      log += ` | ${contextStr}`;
    }
  }

  return log;
}

/**
 * Format a value for logging (truncate large objects/arrays)
 */
function formatValue(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (typeof value === 'string') {
    return value.length > 100 ? `${value.substring(0, 100)}...` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }

  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    return str.length > 200 ? `${str.substring(0, 200)}...` : str;
  }

  return String(value);
}

/**
 * Extract error details including stack trace
 */
export function extractErrorDetails(error: unknown): {
  message: string;
  stack?: string;
  name?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  return {
    message: String(error),
  };
}

/**
 * Log info message with context
 */
export function logInfo(message: string, context?: LogContext): void {
  console.log(formatLog('INFO', message, context));
}

/**
 * Log error message with context and stack trace
 */
export function logError(message: string, error: unknown, context?: LogContext): void {
  const errorDetails = extractErrorDetails(error);

  const enrichedContext = {
    ...context,
    errorName: errorDetails.name,
    errorMessage: errorDetails.message,
  };

  console.error(formatLog('ERROR', message, enrichedContext));

  // Log stack trace separately for readability
  if (errorDetails.stack) {
    console.error('Stack trace:', errorDetails.stack);
  }
}

/**
 * Create metadata object for database storage
 */
export function createErrorMetadata(
  error: unknown,
  context: LogContext & { attempt?: number; duration?: number }
): string {
  const errorDetails = extractErrorDetails(error);

  const metadata = {
    error: {
      name: errorDetails.name,
      message: errorDetails.message,
      stack: errorDetails.stack,
    },
    context: {
      attempt: context.attempt,
      duration: context.duration,
      timestamp: new Date().toISOString(),
      ...context,
    },
  };

  return JSON.stringify(metadata);
}

/**
 * Create success metadata object for database storage
 */
export function createSuccessMetadata(context: LogContext & { duration?: number }): string {
  const metadata = {
    success: true,
    context: {
      duration: context.duration,
      timestamp: new Date().toISOString(),
      ...context,
    },
  };

  return JSON.stringify(metadata);
}

/**
 * Log AI model call details
 */
export function logAICall(
  model: string,
  operation: 'start' | 'success' | 'error',
  context: LogContext & {
    inputSize?: number;
    outputSize?: number;
    chunkIndex?: number;
    totalChunks?: number;
  }
): void {
  const messages = {
    start: `Calling AI model: ${model}`,
    success: `AI model completed: ${model}`,
    error: `AI model failed: ${model}`,
  };

  if (operation === 'error') {
    console.error(formatLog('ERROR', messages[operation], context));
  } else {
    console.log(formatLog('INFO', messages[operation], context));
  }
}

/**
 * Log external API call details
 */
export function logAPICall(
  service: string,
  operation: string,
  status: 'start' | 'success' | 'error',
  context?: LogContext
): void {
  const message = `${service} ${operation} ${status}`;

  if (status === 'error') {
    console.error(formatLog('ERROR', message, context));
  } else {
    console.log(formatLog('INFO', message, context));
  }
}
