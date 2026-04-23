import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";
const level = process.env.LOG_LEVEL || "info";

const logger = pino(
  { level },
  isDev
    ? pino.transport({ target: "pino-pretty", options: { colorize: true } })
    : undefined
);

export default logger;
