// Downloads the same tarball five times with Node's built-in fetch, reading
// the body slowly. Node 22's bundled undici crashes with
// `AssertionError: assert(!this.paused)` when such a response carries
// `Connection: close`.
const url = 'https://registry.npmjs.org/pnpm/-/pnpm-10.33.2.tgz';

for (let i = 1; i <= 5; i++) {
  const response = await fetch(url);
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  console.log(`request ${i}: connection=${response.headers.get('connection')} bytes=${bytes}`);
}

console.log('all requests completed');
