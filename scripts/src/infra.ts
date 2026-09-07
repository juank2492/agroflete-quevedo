/** Gestiona los contenedores locales. */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const COMPOSE_FILE = resolve(RAIZ, 'docker-compose.yml');

interface Contenedor {
  name: string;
  image: string;
  args: string[];
  cmd: string[];
}

const CONTENEDORES: Contenedor[] = [
  {
    name: 'agroflete-dynamodb',
    image: 'amazon/dynamodb-local:2.5.2',
    args: ['-p', '8010:8000'],
    // La base local comparte los datos y vive en memoria.
    cmd: ['-jar', 'DynamoDBLocal.jar', '-sharedDb', '-inMemory'],
  },
  {
    name: 'agroflete-mailpit',
    image: 'axllent/mailpit:v1.21',
    args: [
      '-p',
      '1025:1025',
      '-p',
      '8025:8025',
      '-e',
      'MP_SMTP_AUTH_ACCEPT_ANY=true',
      '-e',
      'MP_SMTP_AUTH_ALLOW_INSECURE=true',
    ],
    cmd: [],
  },
];

function docker(args: string[], inherit = true): { code: number; out: string } {
  const r = spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: inherit ? ['ignore', 'inherit', 'inherit'] : ['ignore', 'pipe', 'pipe'],
  });
  return { code: r.status ?? 1, out: (r.stdout ?? '').trim() };
}

function hayCompose(): boolean {
  return docker(['compose', 'version'], false).code === 0;
}

function compose(args: string[]): number {
  return docker(['compose', '-f', COMPOSE_FILE, ...args]).code;
}

function urls(): void {
  console.log('\nDynamoDB Local: http://localhost:8010');
  console.log('Mailpit UI:     http://localhost:8025');
}

function estado(name: string): 'running' | 'stopped' | 'absent' {
  const { out } = docker(
    ['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.State}}'],
    false,
  );
  if (!out) return 'absent';
  return out.startsWith('running') ? 'running' : 'stopped';
}

function upRun(): void {
  for (const c of CONTENEDORES) {
    const st = estado(c.name);
    if (st === 'running') {
      console.log(`= ${c.name} ya está corriendo`);
      continue;
    }
    if (st === 'stopped') {
      console.log(`> arrancando ${c.name}`);
      if (docker(['start', c.name]).code === 0) continue;
      console.log(`  (no arrancó; se recrea)`);
      docker(['rm', '-f', c.name], false);
    }
    console.log(`> creando ${c.name} (${c.image})`);
    const code = docker(['run', '-d', '--name', c.name, ...c.args, c.image, ...c.cmd]).code;
    if (code !== 0) {
      process.exitCode = code;
      console.error(`  fallo al crear ${c.name} (código ${code}). ¿Puerto ocupado?`);
    }
  }
}

function downRun(): void {
  for (const c of CONTENEDORES) {
    if (estado(c.name) !== 'absent') {
      console.log(`> eliminando ${c.name}`);
      docker(['rm', '-f', c.name]);
    }
  }
}

function logsRun(): void {
  const running = CONTENEDORES.filter((c) => estado(c.name) === 'running').map((c) => c.name);
  if (running[0]) docker(['logs', '-f', running[0]]);
  else console.log('No hay contenedores corriendo.');
}

function up(): void {
  if (hayCompose()) {
    console.log('> docker compose up -d');
    process.exitCode = compose(['up', '-d']) || undefined;
  } else {
    console.log('> compose no disponible; usando docker run');
    upRun();
  }
  urls();
}

function down(): void {
  if (hayCompose()) {
    console.log('> docker compose down');
    process.exitCode = compose(['down']) || undefined;
  } else {
    downRun();
  }
}

function logs(): void {
  if (hayCompose()) compose(['logs', '-f']);
  else logsRun();
}

const cmd = process.argv[2];
if (cmd === 'up') up();
else if (cmd === 'down') down();
else if (cmd === 'logs') logs();
else {
  console.error('Uso: infra.ts <up|down|logs>');
  process.exit(1);
}
