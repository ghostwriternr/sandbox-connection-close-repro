# Sandbox egress `Connection: close` repro

When a Sandbox intercepts outbound traffic (`allowedHosts`, `deniedHosts`, or a
catch-all `outbound` handler), every egress response reaches the container with
`Connection: close`. Connections are never reused, and Node 22's built-in
`fetch()` can crash with `AssertionError: assert(!this.paused)` when it reads a
response body slowly. Tools built on it, such as corepack, fail intermittently.

This repo shows the problem and a Worker-side workaround.

## Run it

The issue only happens on deployed Workers; `wrangler dev` does not reproduce it.
Deploying builds the container image locally, so Docker must be running.

```sh
npm install

npm run deploy:before
curl https://sandbox-connection-close-repro.<your-subdomain>.workers.dev/

npm run deploy:after
curl https://sandbox-connection-close-repro.<your-subdomain>.workers.dev/
```

The request runs [`check.mjs`](check.mjs) in the container. It downloads a
tarball five times with `fetch()` and reads each body slowly.

Before:

```
exit code: 1

request 1: connection=close bytes=4538183
AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:

  assert(!this.paused)

    at Parser.finish (node:internal/deps/undici/undici:6165:9)
```

After:

```
exit code: 0

request 1: connection=keep-alive bytes=4538183
...
request 5: connection=keep-alive bytes=4538183
all requests completed
```

The first request after a deploy waits for the container to start.

## The workaround

[`src/before.ts`](src/before.ts) re-exports the SDK's `ContainerProxy`.
[`src/after.ts`](src/after.ts) exports a subclass that removes the `Connection`
header from every egress response:

```ts
import { ContainerProxy as SandboxContainerProxy } from '@cloudflare/sandbox';

export class ContainerProxy extends SandboxContainerProxy {
  async fetch(request: Request): Promise<Response> {
    const response = await super.fetch(request);
    if (response.status === 101) return response;

    const cleaned = new Response(response.body, response);
    cleaned.headers.delete('connection');
    return cleaned;
  }
}
```

- The Sandbox looks up `ContainerProxy` by export name, so this one class covers
  every intercepted request: `outbound` and `outboundByHost` handlers, and the
  `allowedHosts` and `enableInternet` fallbacks. Existing handlers do not change.
- `new Response(response.body, response)` copies the original status, headers
  and body encoding, then the header is removed from the copy.
- WebSocket upgrades (`101`) are returned untouched because they need their
  `Connection: Upgrade` header.

To clean up afterwards, delete the container application
(`npx wrangler containers list`, then `npx wrangler containers delete <id>`)
and the Worker (`npx wrangler delete`).
