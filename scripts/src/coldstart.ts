/**
 * Mide, de forma aproximada y local, el "arranque" del servidor:
 * tiempo desde el spawn del proceso hasta que imprime "escuchando".
 * Compara el bundle esbuild minificado vs. ejecutar el TS con tsx.
 * (El cold start real de Lambda se mide en AWS; esto solo ilustra el efecto
 *  de minimizar el paquete.)
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RONDAS = 5;
const PORT_BASE = 3600;

interface Variante {
  nombre: string;
  cmd: string;
  args: string[];
}

const variantes: Variante[] = [
  {
    nombre: 'tsx (transpila al vuelo)',
    cmd: process.execPath,
    args: ['--import', 'tsx', 'api/src/entrypoints/http-express/server.ts'],
  },
  {
    nombre: 'bundle esbuild --minify',
    cmd: process.execPath,
    args: ['api/dist-bundle/server.mjs'],
  },
];

function medir(v: Variante, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    const p = spawn(v.cmd, v.args, {
      cwd: RAIZ,
      env: { ...process.env, API_PORT: String(port), NODE_ENV: 'production', LOG_LEVEL: 'info' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let buf = '';
    const onData = (d: Buffer) => {
      buf += d.toString();
      if (buf.includes('escuchando')) {
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        p.kill('SIGTERM');
        resolve(ms);
      }
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    p.on('error', reject);
    setTimeout(() => {
      p.kill('SIGKILL');
      reject(new Error(`timeout: ${buf.slice(-200)}`));
    }, 15000);
  });
}

async function main(): Promise<void> {
  for (const v of variantes) {
    const tiempos: number[] = [];
    for (let i = 0; i < RONDAS; i++) {
      try {
        tiempos.push(await medir(v, PORT_BASE + i));
      } catch (err) {
        console.error(`  fallo (${v.nombre}):`, String(err));
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    tiempos.sort((a, b) => a - b);
    const media = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    const min = tiempos[0] ?? 0;
    console.log(
      `${v.nombre.padEnd(28)}  media ${media.toFixed(0)} ms  ·  min ${min.toFixed(0)} ms  ·  n=${tiempos.length}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
