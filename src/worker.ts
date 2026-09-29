import { getSandbox, Sandbox } from '@cloudflare/sandbox';

// `allowedHosts` routes all egress through the Worker's `ContainerProxy`, and
// `interceptHttps` includes HTTPS requests.
export class EgressSandbox extends Sandbox {
  interceptHttps = true;
  allowedHosts = ['registry.npmjs.org'];
}

interface Env {
  SANDBOX: DurableObjectNamespace<EgressSandbox>;
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    const sandbox = getSandbox(env.SANDBOX, 'repro');
    const result = await sandbox.exec('node /check.mjs');
    return new Response(`exit code: ${result.exitCode}\n\n${result.stdout}\n${result.stderr}`);
  }
};
