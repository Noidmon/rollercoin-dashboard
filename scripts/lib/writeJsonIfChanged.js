// Compartilhado por sync-miners-data.js e sync-racks-data.js (Prompt 90) --
// os dois gravam um campo `generatedAt` (timestamp ISO) que muda a cada
// execução mesmo quando o CATÁLOGO real vindo da API é 100% idêntico ao
// já salvo -- isso fazia `git status` sempre ver diff, e por consequência
// scripts/refresh-all.js sempre commitar/disparar deploy à toa.
//
// writeJsonIfChanged só reescreve o arquivo se o conteúdo (ignorando o
// campo indicado, por padrão `generatedAt`) for DIFERENTE do que já está
// em disco -- se for igual, mantém o arquivo (e o generatedAt antigo)
// intocado, então `git status` não vê diff nenhum. Comparação via
// stableStringify (chaves de objeto ordenadas recursivamente) em vez de
// `JSON.stringify` direto -- não depende de ordem de inserção coincidir
// entre a chamada antiga e a nova pra detectar igualdade real.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function withoutKey(obj, key) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const { [key]: _omitted, ...rest } = obj
  return rest
}

// Lê o arquivo já salvo (se existir e for JSON válido) e compara com
// `newData` ignorando `ignoreKey` nos dois lados. Só grava se for
// realmente diferente -- devolve { written: boolean } pro chamador
// reportar no resumo.
export function writeJsonIfChanged(filePath, newData, { ignoreKey = 'generatedAt' } = {}) {
  let previous = null
  if (existsSync(filePath)) {
    try {
      previous = JSON.parse(readFileSync(filePath, 'utf-8'))
    } catch {
      // Arquivo corrompido/ilegível -- trata como "sem versão anterior
      // válida pra comparar", sempre reescreve nesse caso.
      previous = null
    }
  }

  if (previous !== null && stableStringify(withoutKey(previous, ignoreKey)) === stableStringify(withoutKey(newData, ignoreKey))) {
    return { written: false }
  }

  writeFileSync(filePath, JSON.stringify(newData))
  return { written: true }
}
