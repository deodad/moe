import { rmSync } from "node:fs";
import { spawn } from "node:child_process";

const databasePath = "/tmp/moe-playwright.db";
for (const suffix of ["", "-shm", "-wal"]) rmSync(`${databasePath}${suffix}`, { force: true });

const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--port", "3001"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => next.kill(signal));
}

next.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
