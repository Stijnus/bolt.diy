declare module '../build/server' {
  import type { ServerBuild } from '@remix-run/cloudflare';

  const build: ServerBuild;
  export = build;
}
