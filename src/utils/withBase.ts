// GitHub Pages serve o site em https://<usuario>.github.io/<repo>/, não na
// raiz do domínio -- vite.config.ts define `base` de acordo (ver comentário
// lá), e import.meta.env.BASE_URL reflete esse valor em runtime (sempre
// termina com "/", inclusive quando é só "/" pra deploy na raiz).
//
// TODO caminho absoluto-raiz usado em runtime (fetch de JSON em public/data/,
// <img src> de ícones em public/*-icons/) precisa passar por aqui -- Vite só
// reescreve automaticamente os caminhos que ele processa em build-time
// (imports, tags do próprio index.html); uma string literal tipo
// fetch('/data/miners.json') ou <img src="/miners-icons/x.gif"> NUNCA é
// reescrita sozinha, e sob um base path não-raiz ela resolveria contra a
// RAIZ do domínio (ex: github.io/data/miners.json em vez de
// github.io/rollercoin-dashboard/data/miners.json), sempre 404.
export function withBase(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}

// Mesma correção, só que pra uma lista de itens de catálogo já parseados
// (Miner[]/RackCatalogItem[]/etc) -- normaliza o campo `image` de TODOS de
// uma vez, logo depois do fetch+parse, uma única vez por chamada. Preferível
// a corrigir em cada <img src={item.image}> individualmente: o mesmo dado
// (ex: miners.json) é consumido por vários componentes/hooks diferentes
// depois de passar por hooks/estado -- normalizar na origem (uma vez por
// fetch) garante que NENHUM consumidor downstream precise saber disso.
export function withImageBase<T extends { image: string | null }>(items: T[]): T[] {
  return items.map((item) => (item.image ? { ...item, image: withBase(item.image) } : item))
}

// Cache-busting só pros JSONs de dado em public/data/ (miners.json,
// racks.json, etc) -- eles têm nome FIXO e são sobrescritos no lugar a cada
// sync, então o navegador pode continuar servindo uma versão velha em cache
// mesmo depois de um deploy novo (diferente do JS/CSS, que o Vite já
// hasheia no nome do arquivo sozinho). VITE_BUILD_VERSION vem do hash curto
// do commit, injetado pelo workflow de deploy (ver .github/workflows/deploy.yml)
// -- muda a cada deploy, então basta pra invalidar o cache. Em dev local
// (sem essa variável) cai pra "dev", que não quebra nada (só não faz
// cache-busting nenhum, o que é inofensivo com `npm run dev`).
//
// NÃO usar em imagens (withBase/withImageBase continuam sem isso) -- cada
// ícone tem nome próprio e nunca é sobrescrito, cache longo nelas é
// desejável.
const BUILD_VERSION = import.meta.env.VITE_BUILD_VERSION || 'dev'

export function withCacheBust(path: string): string {
  return `${withBase(path)}?v=${BUILD_VERSION}`
}
