// Compartilhado por sync-miners-data.js e sync-racks-data.js -- os dois
// fazem dezenas de requisições paginadas seguidas contra a mesma API (Minar
// y Ganar) e, em runs longos (miners.json tem 71 páginas), isso pode bater
// no rate limit dela (429 Too Many Requests) no meio do caminho. Sem retry,
// isso derrubava o script inteiro (exit code 1) sem salvar nada da execução
// -- confirmado em produção, GitHub Actions falhou na página 67/71.
//
// Só 429 tem retry com backoff exponencial: outros erros (403 sem Referer,
// 500, etc) não se resolvem esperando e devem falhar rápido, sem mascarar
// um problema real.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const MAX_RETRIES = 5
const INITIAL_RETRY_DELAY_MS = 2000

export async function fetchJson(url, options) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, options)
    if (response.status === 429) {
      if (attempt >= MAX_RETRIES) {
        throw new Error(`429 Too Many Requests -- esgotadas ${MAX_RETRIES} tentativas -- ${url}`)
      }
      const delayMs = INITIAL_RETRY_DELAY_MS * 2 ** attempt
      console.log(`  429 recebido -- tentativa ${attempt + 1}/${MAX_RETRIES}, esperando ${delayMs}ms antes de repetir a mesma página...`)
      await sleep(delayMs)
      continue
    }
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} -- ${url}`)
    }
    return response.json()
  }
}
