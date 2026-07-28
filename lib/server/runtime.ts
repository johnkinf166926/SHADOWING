import { env } from "cloudflare:workers";

export interface ShadowingRuntimeEnv {
  DB: D1Database;
  UPLOADS: R2Bucket;
}

export function getRuntimeEnv(): ShadowingRuntimeEnv {
  const bindings = env as unknown as Partial<ShadowingRuntimeEnv>;
  if (!bindings.DB) {
    throw new Error("数据库未初始化：缺少 DB 持久化绑定");
  }
  if (!bindings.UPLOADS) {
    throw new Error("文件存储未初始化：缺少 UPLOADS 持久化绑定");
  }
  return bindings as ShadowingRuntimeEnv;
}

export function getDatabase(): D1Database {
  const bindings = env as unknown as Partial<ShadowingRuntimeEnv>;
  if (!bindings.DB) {
    throw new Error("数据库未初始化：缺少 DB 持久化绑定");
  }
  return bindings.DB;
}

export function getUploadBucket(): R2Bucket {
  const bindings = env as unknown as Partial<ShadowingRuntimeEnv>;
  if (!bindings.UPLOADS) {
    throw new Error("文件存储未初始化：缺少 UPLOADS 持久化绑定");
  }
  return bindings.UPLOADS;
}
