"use strict";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value)
    throw new Error(
      `Missing required deployment environment variable: ${name}`,
    );
  return value;
}

const baseDir = requiredEnv("BASE_DIR");
const appName = requiredEnv("PM2_APP_NAME");
const appEnv = requiredEnv("APP_ENV");
const appHost = requiredEnv("APP_HOST");
const appPort = requiredEnv("APP_PORT");
const logDir = process.env.PM2_LOG_DIR || `${baseDir}/shared/logs`;

module.exports = {
  apps: [
    {
      name: appName,
      cwd: `${baseDir}/current`,
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart:
        process.env.PM2_MAX_MEMORY ||
        (appEnv === "production" ? "700M" : "450M"),
      restart_delay: 3000,
      kill_timeout: 15000,
      listen_timeout: 15000,
      wait_ready: false,
      env: {
        NODE_ENV: "production",
        APP_ENV: appEnv,
        HOSTNAME: appHost,
        PORT: appPort,
        APP_REVISION: process.env.APP_REVISION,
        NODE_OPTIONS:
          process.env.NODE_OPTIONS ||
          (appEnv === "production"
            ? "--max-old-space-size=512"
            : "--max-old-space-size=320"),
        TZ: process.env.TZ || "Africa/Dar_es_Salaam",
      },
      out_file: `${logDir}/${appName}-out.log`,
      error_file: `${logDir}/${appName}-error.log`,
      merge_logs: true,
      time: true,
    },
  ],
};
