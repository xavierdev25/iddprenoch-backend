import pino from 'pino';
import { env } from '../config/env';

// JSON-per-line logs to stdout/stderr — Passenger on cPanel captures these to the app's
// log file automatically, so no separate log transport/infrastructure is needed here.
export const logger = pino({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
});
