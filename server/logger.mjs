import winston from 'winston'
const { format, transports, createLogger } = winston
import WinstonConsoleFormat from "winston-console-format";
const { consoleFormat } = WinstonConsoleFormat

const debug = process.env.NODE_ENV !== 'production'

const cFormat = format.combine(
  format.colorize({ all: true }),
  format.padLevels(),
  consoleFormat({
    showMeta: true,
    metaStrip: ['timestamp', 'service'],
    inspectOptions: {
      depth: Infinity,
      colors: true,
      maxArrayLength: Infinity,
      breakLength: 120,
      compact: Infinity,
    },
  })
)

const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.ms(),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({ level: debug ? 'debug' : 'info', format: cFormat }),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log', level: 'debug' }),
  ],
});

export default logger