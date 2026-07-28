/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    UPLOADS: R2Bucket;
  }
}

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}
