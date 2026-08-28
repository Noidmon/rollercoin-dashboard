# RollerCoin Dashboard

Dashboard pessoal para acompanhar minha conta do [RollerCoin](https://rollercoin.com/) — poder da sala, progresso de liga, mineradores, merges, hamsters, eventos e um simulador de sala com um auto-otimizador de posicionamento. Comecei este projeto porque as ferramentas de terceiro que eu usava para isso estavam espalhadas em vários sites diferentes; a ideia aqui é centralizar tudo num só lugar, com a lógica de cálculo aberta e auditável.

Este é um projeto pessoal/hobby, sem qualquer afiliação oficial com a RollerCoin.

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + React Router v7
- **Backend**: um único Cloudflare Worker, usado como proxy de CORS para a API pública do RollerCoin e para guardar o evento atual (Cloudflare KV)

## Rodando localmente

Pré-requisitos: Node.js e uma conta Cloudflare (só necessária se você for rodar/editar o Worker também — o frontend sozinho funciona contra o Worker já publicado).

```bash
npm install
```

### Variável de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```
VITE_PROXY_URL=https://SEU-WORKER.workers.dev
```

Aponte para o Worker publicado (o seu, ou um próprio se você fizer deploy do `worker/`).

### Comandos

```bash
npm run dev       # servidor de desenvolvimento (Vite)
npm run build     # build de produção (tsc + vite build)
npm run lint      # oxlint
npm run preview   # preview do build de produção
```

Nota: o `base` do Vite está fixado em `/rollercoin-dashboard/` (ver [Deploy](#deploy) abaixo) — `npm run dev`/`npm run preview` também servem sob esse prefixo (ex: `http://localhost:5173/rollercoin-dashboard/`), não na raiz.

### O Worker (`worker/`)

O Worker faz duas coisas: (1) repassa chamadas para `rollercoin.com/api/*` adicionando os headers de CORS que o navegador exige, e (2) guarda o JSON do evento atual num namespace do Cloudflare KV, exposto em `/api/progression-data/current` (GET público, POST protegido por senha).

Para rodar/publicar o seu próprio:

```bash
npx wrangler kv namespace create EVENTS_KV   # gera o id pra colocar em wrangler.toml
npx wrangler secret put ADMIN_PASSWORD       # senha do endpoint de admin -- NUNCA em texto puro no repo
npx wrangler deploy
```

A página `/admin` usa essa senha para publicar o JSON do evento atual (colado manualmente a partir dos dados públicos do jogo).

## Deploy

O frontend é publicado no **GitHub Pages**, automaticamente a cada push na branch `main` via `.github/workflows/deploy.yml` (build + `actions/deploy-pages`, sem branch `gh-pages` manual). Único passo manual, uma vez só: em **Settings → Pages → Source**, selecionar **GitHub Actions**.

O Worker (`worker/`) é publicado à parte, direto via `npx wrangler deploy` (não faz parte deste workflow).

## Fontes de dados

Todos os dados da sua conta (poder, mineradores, racks, hamsters, room-config) vêm de **endpoints públicos do RollerCoin** — nenhum login, cookie de sessão ou token pessoal é usado ou armazenado em nenhum momento; a busca é sempre pelo nickname público do jogador.

O catálogo estático complementar (ficha técnica de mineradores, racks e sets temáticos, que o RollerCoin não expõe de forma fácil de consumir) vem de um parceiro de dados público, o **[Minar y Ganar](https://minaryganar.com/)**, via scripts em `scripts/sync-*.js` que baixam e versionam esses dados em `public/data/`.

### Nota de transparência sobre engenharia reversa

Parte da lógica de posicionamento visual da sala (coordenadas de pixel de cada rack/slot, recorte de sprite) foi obtida lendo o bundle JavaScript público do simulador de sala do **minaryganar.com** — são números/fórmulas sobre como o jogo real desenha a sala, tratados como fato observável sobre o RollerCoin, não como propriedade de terceiro. Da mesma forma, o comportamento do **RC Calculator, de Ariel Ruiz** ([ariel-ruiz.github.io](https://ariel-ruiz.github.io/)), foi usado como referência de comportamento observado para a calculadora de recompensas de eventos, o custo de merges e a ordem de preenchimento do auto-otimizador da sala.

Em todos os casos, **nenhum código-fonte de terceiro foi copiado, adaptado ou redistribuído** — todo o código deste repositório foi escrito do zero; só os *dados/comportamentos observados* (uma fórmula, uma tabela de coordenadas, uma constante de conversão) foram usados como referência factual sobre como o próprio jogo funciona.

## Estrutura

```
src/
  pages/        # uma página por rota (Dashboard, Mineradores, Merges, Hamsters, Eventos, Simulador, Admin, ...)
  components/   # componentes de UI reutilizados entre páginas
  hooks/        # estado compartilhado (inventário importado, auto-otimizador, ...)
  utils/        # cálculos puros (poder, merges, layout da sala, eventos, ...)
  data/         # constantes e tabelas extraídas/confirmadas contra o jogo real
worker/         # Cloudflare Worker (proxy de CORS + KV do evento atual)
scripts/        # scripts de sincronização de dados estáticos (catálogo, ícones, sprites)
public/data/    # catálogo estático sincronizado (miners.json, racks.json, ...)
```
