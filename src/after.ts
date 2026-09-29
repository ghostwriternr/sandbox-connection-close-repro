import { ContainerProxy as SandboxContainerProxy } from '@cloudflare/sandbox';

export { default, EgressSandbox } from './worker';

// Removes the `Connection` header from intercepted egress responses so the
// container's connection stays open. WebSocket upgrades (101) need their
// `Connection: Upgrade` header and are returned unchanged.
export class ContainerProxy extends SandboxContainerProxy {
  async fetch(request: Request): Promise<Response> {
    const response = await super.fetch(request);
    if (response.status === 101) return response;

    const cleaned = new Response(response.body, response);
    cleaned.headers.delete('connection');
    return cleaned;
  }
}
