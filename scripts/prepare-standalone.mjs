import { cp, mkdir, rm } from "node:fs/promises";

const standaloneStatic = ".next/standalone/.next/static";
const standalonePublic = ".next/standalone/public";

await rm(standaloneStatic, { recursive: true, force: true });
await rm(standalonePublic, { recursive: true, force: true });
await mkdir(".next/standalone/.next", { recursive: true });
await cp(".next/static", standaloneStatic, { recursive: true });
await cp("public", standalonePublic, { recursive: true });
