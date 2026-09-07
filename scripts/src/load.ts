/* eslint-disable @typescript-eslint/no-explicit-any */
import autocannon from 'autocannon';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : fallback;
}

function headers(): Record<string, string> {
  const out: Record<string, string> = {};
  process.argv.forEach((a, i) => {
    if (a === '--header' && process.argv[i + 1]) {
      const raw = process.argv[i + 1] as string;
      const idx = raw.indexOf(':');
      if (idx > 0) out[raw.slice(0, idx).trim()] = raw.slice(idx + 1).trim();
    }
  });
  return out;
}

const url = arg('url', 'http://localhost:3000/salud');
const connections = Number(arg('connections', '100'));
const duration = Number(arg('duration', '30'));
const method = arg('method', 'GET') as any;

console.log(`Carga: ${connections} conexiones, ${duration}s, ${method} -> ${url}`);

autocannon(
  { url, connections, duration, method, headers: headers() },
  (err: Error | null, result: any) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(autocannon.printResult(result));
    console.log('\nResumen para docs/reporte-metricas.md:');
    console.log(`  peticiones totales : ${result.requests.total}`);
    console.log(`  req/s (media)      : ${result.requests.average}`);
    console.log(`  latencia p50 (ms)  : ${result.latency.p50}`);
    console.log(`  latencia p97.5 (ms): ${result.latency.p97_5}`);
    console.log(`  latencia p99 (ms)  : ${result.latency.p99}`);
    console.log(`  errores / timeouts : ${result.errors} / ${result.timeouts}`);
    console.log(`  memoria (load proc): ${JSON.stringify(process.memoryUsage())}`);
  },
);
