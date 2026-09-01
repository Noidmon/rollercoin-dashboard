// Roda os 3 scripts de sincronização de dados em sequência e, se algo
// mudou, commita e dá push -- reusado tanto localmente (`npm run refresh`)
// quanto pelo workflow .github/workflows/refresh-data.yml (disparado pelo
// botão "Atualizar Dados" da página /admin, via API do GitHub).
//
// Bug real encontrado (Prompt 93): o push resultante daqui é feito com o
// GITHUB_TOKEN padrão do job (dentro do Actions) -- e push autenticado com
// GITHUB_TOKEN NÃO dispara o trigger `on: push` de outros workflows no
// mesmo repositório (proteção nativa do GitHub contra loop infinito entre
// workflows). Achado rodando de verdade: 2 refreshes consecutivos
// commitaram certinho (minerador novo + banner de evento sincronizados),
// mas "Deploy to GitHub Pages" nunca rodou pra nenhum dos dois -- o site
// ficou dias sem refletir dado já commitado. Corrigido expondo se ESTE
// run commitou algo via GITHUB_OUTPUT (setCommittedOutput abaixo) --
// refresh-data.yml usa isso pra decidir se dispara deploy.yml
// explicitamente via workflow_dispatch (exceção documentada à regra
// acima).
//
// Uso:
//   node scripts/refresh-all.js
//   npm run refresh

import { spawn, execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Mesma URL pública já hardcoded no workflow de deploy (worker/index.js) --
// não é segredo (é só o endpoint GET público que a página /eventos já
// consome pra mostrar o evento atual), consistente com a decisão já tomada
// lá de não exigir configuração extra pra isso funcionar.
const EVENTS_ENDPOINT = 'https://rollercoin-proxy.chris-rlt.workers.dev/api/progression-data/current'

// spawn (não execFileSync) pros scripts de sync -- alguns demoram (baixam
// ~1600+ imagens), stdio 'inherit' pro stdout/stderr deixa o progresso
// deles visível ao vivo no terminal (local) ou no log do Actions (CI), em
// vez de aparecer tudo de uma vez só no final.
//
// stdin SEMPRE via pipe, mesmo quando não há dado nenhum (stdinData
// undefined -> escreve string vazia e fecha) -- em vez de 'inherit'
// condicional, que dependeria de sutilezas de TTY (terminal interativo
// local vs stdin não-TTY no runner do Actions) pra não travar esperando
// entrada. Um EOF imediato e explícito funciona igual nos dois contextos:
// sync-rc-icons.js já trata stdin vazio como "sem evento", só sincroniza
// os ícones fixos de UI.
function runScript(relativePath, { stdinData } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(ROOT, relativePath)], {
      cwd: ROOT,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
    child.stdin.end(stdinData ?? '')
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${relativePath} saiu com código ${code}`))
    })
  })
}

// Só escreve quando rodando dentro do Actions (GITHUB_OUTPUT setado pelo
// runner) -- no-op local, sem side-effect nenhum fora do CI.
function setCommittedOutput(committed) {
  const file = process.env.GITHUB_OUTPUT
  if (!file) return
  appendFileSync(file, `committed=${committed}\n`)
}

function hasGitChanges() {
  const output = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf-8' })
  return output.trim().length > 0
}

// execFileSync (argv, sem shell) em vez de string+execSync -- evita
// qualquer problema de escaping da mensagem de commit (tem parênteses) em
// shells diferentes (bash local, cmd/PowerShell no Windows, sh no runner
// do Actions).
function git(args) {
  execFileSync('git', args, { cwd: ROOT, stdio: 'inherit' })
}

// sync-rc-icons.js aceita o JSON do evento por stdin (mesmo fluxo manual já
// usado em rodadas anteriores: `curl .../current | node scripts/sync-rc-icons.js`)
// -- busca aqui e repassa direto, sem precisar de arquivo temporário.
async function fetchCurrentEventJson() {
  const response = await fetch(EVENTS_ENDPOINT)
  if (response.status === 404) {
    console.log('nenhum evento configurado no KV ainda (404) -- sync-rc-icons.js roda só com os ícones fixos de UI.')
    return undefined
  }
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} ao buscar o evento atual em ${EVENTS_ENDPOINT}`)
  }
  return response.text()
}

async function main() {
  console.log('=== 1/3: sync-miners-data.js ===')
  await runScript('scripts/sync-miners-data.js')

  console.log('\n=== 2/3: sync-racks-data.js ===')
  await runScript('scripts/sync-racks-data.js')

  console.log('\n=== 3/3: sync-rc-icons.js (evento atual) ===')
  const eventJson = await fetchCurrentEventJson()
  await runScript('scripts/sync-rc-icons.js', { stdinData: eventJson })

  console.log('\n=== Verificando mudanças ===')
  if (!hasGitChanges()) {
    console.log('nada novo, nenhum commit necessário.')
    setCommittedOutput(false)
    return
  }

  console.log('mudanças detectadas -- commitando...')
  git(['add', '-A'])
  git(['commit', '-m', 'chore: refresh de dados (miners/racks/eventos)'])
  // HEAD:main explícito (não só `git push`) -- funciona tanto localmente
  // quanto no runner do Actions, onde o checkout costuma deixar o repo em
  // detached HEAD (sem branch local com upstream configurado, onde um
  // `git push` puro falharia).
  git(['push', 'origin', 'HEAD:main'])
  console.log('commit e push feitos.')
  setCommittedOutput(true)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
