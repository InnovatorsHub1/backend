type LogContext = {
  timestamp?: string;
  environment?: string;
  errorCode?: number;
  duration?: number;
  method?: string;
  path?: string;
  statusCode?: number;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
};

export type MaskableData = LogMeta & {
  [key: string]: string | undefined | Record<string, unknown>;
};

export interface LogMeta {
  requestId?: string;
  userId?: string;
  service?: string;
  context?: Record<string, LogContext>;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  requestId?: string;
  userId?: string;
  service: string;
  context?: Record<string, LogContext>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LogTransport {
  name: string;
  write(entry: LogEntry): Promise<void>;
}
