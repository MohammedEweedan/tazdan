// Structured logger. In production emits JSON to stdout + rotating file.
// In development emits colorized human-readable text.
import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import { requestContext } from '../middleware/requestContext';
import { redactLogValue } from './redaction';

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProduction
      ? combine(errors({ stack: true }), timestamp(), json())
      : combine(colorize(), simple()),
  }),
];

if (isProduction) {
  transports.push(
    new (winston.transports as any).DailyRotateFile({
      filename: path.join('logs', 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '14d',
      zippedArchive: true,
      format: combine(errors({ stack: true }), timestamp(), json()),
    }),
    new (winston.transports as any).DailyRotateFile({
      filename: path.join('logs', 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      zippedArchive: true,
      format: combine(errors({ stack: true }), timestamp(), json()),
    }),
  );
}

export const logger = winston.createLogger({
  format: combine(winston.format((info) => {
    for (const key of Object.keys(info)) info[key] = redactLogValue(info[key]);
    const context = requestContext.getStore();
    if (context) info.requestId = context.requestId;
    return info;
  })()),
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  transports,
  exitOnError: false,
});
