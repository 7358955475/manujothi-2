import fs from 'fs';
import path from 'path';

enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

class Logger {
  private logDir: string;

  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaString = meta ? ` | Meta: ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaString}\n`;
  }

  private writeToFile(level: LogLevel, message: string): void {
    const fileName = `${new Date().toISOString().split('T')[0]}.log`;
    const filePath = path.join(this.logDir, fileName);
    
    try {
      fs.appendFileSync(filePath, message);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, message: string, meta?: any): void {
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Console output with colors
    switch (level) {
      case LogLevel.ERROR:
        console.error(`\x1b[31m${formattedMessage.trim()}\x1b[0m`);
        break;
      case LogLevel.WARN:
        console.warn(`\x1b[33m${formattedMessage.trim()}\x1b[0m`);
        break;
      case LogLevel.INFO:
        console.info(`\x1b[36m${formattedMessage.trim()}\x1b[0m`);
        break;
      case LogLevel.DEBUG:
        if (process.env.NODE_ENV === 'development') {
          console.log(`\x1b[90m${formattedMessage.trim()}\x1b[0m`);
        }
        break;
    }

    // Write to file in production
    if (process.env.NODE_ENV === 'production') {
      this.writeToFile(level, formattedMessage);
    }
  }

  error(message: string, meta?: any): void {
    this.log(LogLevel.ERROR, message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log(LogLevel.WARN, message, meta);
  }

  info(message: string, meta?: any): void {
    this.log(LogLevel.INFO, message, meta);
  }

  debug(message: string, meta?: any): void {
    this.log(LogLevel.DEBUG, message, meta);
  }
}

export const logger = new Logger();
export default logger;