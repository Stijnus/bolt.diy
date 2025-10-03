import type { ServerBuild } from '@remix-run/cloudflare';
import { createPagesFunctionHandler } from '@remix-run/cloudflare-pages';

export const onRequest: PagesFunction = async (context) => {
  try {
    // Use dynamic import with string template to avoid TypeScript static analysis
    const serverBuildPath = '../build/server';
    const serverBuild = (await import(/* @vite-ignore */ serverBuildPath)) as unknown as ServerBuild;

    const handler = createPagesFunctionHandler({
      build: serverBuild,
    });

    return handler(context);
  } catch (error) {
    // Handle case when build/server doesn't exist (during development)
    return new Response('Build not found. Please run the build process first.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
};
