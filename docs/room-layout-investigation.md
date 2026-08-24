# Investigação: layout de fundo de sala (bundle JS do minaryganar.com)

Fonte: `RoomSimulatorPublicPage-EzqF4VDA.js` (hash mudou desde a última sessão —
era `CYGRNbXA` quando o usuário olhou via DevTools; o site redeployou nesse meio
tempo, release atual `/releases/20260823191520/`). Baixado direto via `curl`,
sem autenticação. Chunks relacionados também baixados: `gameSprites-*.js` e
`spriteImageCache-*.js` (ambos pequenos, só helpers de cache de sprite — não
têm dado de layout).

## Descoberta principal: "roomN_done" é pasta de SKIN, não "nível de sala"

Achado essencial que muda a interpretação da investigação anterior: o dígito em
`room1_done` / `room3_done` etc. **não é o nível da sala (grid 0-3 do jogo)** —
é o nome interno da pasta de assets de UM skin específico (`appearanceId`).

Prova no próprio bundle:

```js
jt = "60770a4665dce86c866dd720"       // appearanceId do skin atualmente default no site
Hr = `room-backgrounds/${jt}`          // pasta base = room-backgrounds/{appearanceId}
function I(e) { return `${Hr}/${e}` }  // helper que monta a URL final
```

E o objeto `Kr` (a config completa da sala) é quem de fato mapeia os **4 slots
de sala do jogo** (0-3, batendo com `rooms_available` do room-config real) pros
arquivos de decoração:

```js
Kr = {
  appearanceId: jt,
  window: { asset: I("room3_done/essentials/scy.png"), width: 720, height: 100, speed: .1 },
  rooms: {
    0: { tiles: De("room_pc"),   decorations: Ur },
    1: { tiles: De("room_else"), decorations: Ze },
    2: { tiles: De("room_else"), decorations: Ze },
    3: { tiles: De("room_else"), decorations: Ze },
  }
}
```

**Achado confirmado (não é suposição): a sala 0 (primeira sala) tem decoração
própria (`Ur` + tiles `room_pc`); as salas 1, 2 e 3 compartilham EXATAMENTE a
mesma decoração (`Ze` + tiles `room_else`) — só 2 composições distintas no
total, não 4.** Isso explica por que cliquei nas abas "2/3/4" do simulador
numa sessão anterior e não vi requisições de rede novas: dentro desse mesmo
skin, salas 2, 3 e 4 (UI, 1-indexed) realmente reaproveitam o mesmo asset set.

⚠️ Nota de honestidade: essa pasta `room3_done` pertence ao skin
`60770a4665dce86c866dd720` — **diferente** do skin `default`/`room1_done` (50
arquivos, catalogados na investigação anterior) que a mesma ferramenta servia
há pouco. O site trocou o skin-padrão exibido a visitantes entre as duas
sessões de investigação (evidência: hash do bundle mudou, `appearanceId`
mudou, pasta mudou de `room1_done` pra `room3_done`). As duas listas abaixo
são de **skins diferentes**, não de "versões" um do outro — ambas são dados
reais e válidos, só não comparáveis diretamente linha a linha.

## `De(e)` — gerador das 12 "tiles" (placeholder de slot vazio)

```js
function De(e) {
  return Array.from({ length: 12 }, (t, n) =>
    I(`room3_done/${e}/${String(n + 1).padStart(2, "0")}.png`)
  )
}
```

Só gera as 12 URLs (`room_pc/01.png` .. `12.png` ou `room_else/01.png` ..
`12.png`) — **sem left/top individuais no bundle**. Confirma o achado anterior
de que a maioria desses 12 arquivos por conjunto são bytes idênticos
(placeholder repetido) — o posicionamento deles na grade deve vir de uma
fórmula/grid separada em outro trecho do componente (não localizada como
array de objetos; é provavelmente CSS grid/flex no JSX, fora do escopo de um
bundle minificado dar pra extrair sem mapear o componente inteiro).

## Nível 0 (`Ur`) — 13 entradas (+ 1 overlay aninhado)

```js
Ur = [
  { asset: I("room3_done/decore1.png"),  left: 0,   top: 2,   width: 90,  height: 123,
    overlay: { asset: I("room3_done/decore1_light.png"), left: 0, top: 13, width: 90, height: 112 } },
  { asset: I("room3_done/decore2.png"),  left: 90,  top: 12,  width: 90,  height: 113 },
  { asset: I("room3_done/decore3.png"),  left: 90,  top: 127, width: 45,  height: 22  },
  { asset: I("room3_done/decore4.png"),  left: 454, top: 73,  width: 90,  height: 77  },
  { asset: I("room3_done/decore5.png"),  left: 540, top: 96,  width: 90,  height: 53  },
  { asset: I("room3_done/decore6.png"),  left: 630, top: 84,  width: 90,  height: 66  },
  { asset: I("room3_done/decore7.png"),  left: 0,   top: 334, width: 90,  height: 115 },
  { asset: I("room3_done/decore8.png"),  left: 90,  top: 395, width: 90,  height: 53  },
  { asset: I("room3_done/decore9.png"),  left: 90,  top: 326, width: 90,  height: 49  },
  { asset: I("room3_done/decore10.png"), left: 540, top: 300, width: 180, height: 149 },
  { asset: I("room3_done/essentials/trophy_shelf.png"), left: 180, top: 0, width: 90,  height: 125 },
  { asset: I("room3_done/essentials/chair.png"),        left: 270, top: 0, width: 90,  height: 150 },
  { asset: I("room3_done/essentials/Table.png"),        left: 270, top: 0, width: 135, height: 150 },
]
```

Nenhum campo extra além de `asset/left/top/width/height` (e o `overlay`
aninhado, mesma forma, só em `decore1`). Sem z-index, sem opacidade, sem
frame_rate — esses sprites são estáticos.

## Níveis 1, 2 e 3 (`Ze`, compartilhado pelos 3) — 5 entradas

```js
Ze = [
  { asset: I("room3_done/decore11.png"), left: 0,   top: 67,  width: 180, height: 83 },
  { asset: I("room3_done/decore12.png"), left: 541, top: 102, width: 45,  height: 47 },
  { asset: I("room3_done/decore13.png"), left: 630, top: 24,  width: 90,  height: 101 },
  { asset: I("room3_done/decore14.png"), left: 540, top: 375, width: 180, height: 75 },
  { asset: I("room3_done/decore15.png"), left: 540, top: 300, width: 180, height: 75 },
]
```

## Elemento "essencial" que é compartilhado por TODAS as salas: a janela

```js
window: { asset: I("room3_done/essentials/scy.png"), width: 720, height: 100, speed: .1 }
```

Estrutura **diferente** dos `decoreN` — não tem `left/top` (provavelmente
sempre fixo no topo, posicionado via CSS/JSX fora do bundle minificado), tem
`speed: .1` (não visto em nenhum outro item — confirma que é uma cena de
fundo animada/parallax, a "janela" com paisagem que se move devagar,
consistente com o nome do arquivo `scy` = "sky"). `Table.png`/`chair.png`/
`trophy_shelf.png`, por outro lado, **seguem exatamente o mesmo formato**
`{asset,left,top,width,height}` dos `decoreN` — não são um caso especial,
estão dentro do próprio array `Ur` junto com os decores.

## Bônus: crop-box de racks (achado não pedido, mas relevante pra Fase B)

Achei um mapa de exceções de crop (recorte de padding transparente) por rack,
mais um valor default:

```js
Is = {  // exceções -- só 4 racks têm crop diferente do padrão
  "racks/jet_black_rack_8.webp": { left: 34, top: 4, right: 92, bottom: 96 },
  "racks/globes_rack_8.webp":    { left: 38, top: 10, right: 87, bottom: 90 },
  "racks/showcase_rack_8.webp":  { left: 39, top: 10, right: 87, bottom: 90 },
  "racks/royal_rack_8.webp":     { left: 38, top: 10, right: 88, bottom: 90 },
}
Ds = { left: 34, top: 4, right: 92, bottom: 96 }  // default pra todos os outros racks

j  = { width: 75,  height: 120 }  // provável tamanho de célula renderizada de rack
As = { width: 126, height: 100 }  // provável tamanho de célula renderizada de miner
```

Isso é usado (função `Fs`, não detalhada aqui) pra cortar a área útil de cada
sprite de rack antes de desenhar — a maioria dos 72 racks do catálogo usa o
crop-box default `Ds`; só 4 têm padding irregular o suficiente pra precisar
de override manual.

## Resposta às perguntas do relatório (1ª rodada)

- **Quantos "níveis de sala" (`roomN_done`) existem no arquivo**: só
  **1 pasta de skin** aparece hardcoded neste bundle — `room3_done` (21
  ocorrências no arquivo). `room1_done`, `room2_done`, `room4_done`,
  `room5_done` — **0 ocorrências** cada. (A pasta `room1_done` que a
  investigação anterior catalogou pertence a um OUTRO skin, `default`, visto
  rodando ao vivo numa sessão anterior — não está mais sendo servido como
  default agora.)
- **Quantas entradas de layout por nível de sala do JOGO (0-3)**: nível 0 tem
  13 entradas posicionadas (`Ur`) + 12 tiles sem posição própria (`De("room_pc")`);
  níveis 1, 2 e 3 **compartilham** as mesmas 5 entradas posicionadas (`Ze`) +
  12 tiles sem posição própria (`De("room_else")`) cada.
- **Total de entradas com `left/top/width/height` no arquivo inteiro**: 19
  (13 de `Ur`, incluindo o overlay aninhado de `decore1`, + 5 de `Ze` + 1
  `window` sem left/top mas com width/height/speed).

---

# Atualização: conversão célula → pixel dos RACKS + confirmação de URLs

## 1. Conversão célula → pixel — NÃO é fórmula, é uma TABELA completa e irregular

Busquei `racks_zone`, `cellWidth`, `cellSize`, `CELL_`, `row_shift` etc. — **0
ocorrências de todos**. Esses nomes do `room-config` real (racks_zone.x/y,
row_shift) não existem no bundle do minaryganar — eles não replicam a fórmula
da RollerCoin real, construíram a própria tabela de posições, hand-tuned pra
bater com a arte deles.

Achei a variável real usada pra isso: `Dr` (referenciada como `slots:Dr` dentro
de `Fr={room:Ar,minerAnchor:Ir,slots:Dr}`). **Não é uma fórmula com
"pixels por célula" — é uma tabela literal, hardcoded, com uma entrada por
posição de rack (roomLevel, x, y) → (left, top) em pixels**, para dois
viewports (`desktop` e `mobile`), 4 níveis de sala cada. Confirmado por
`grep` direto no bundle (fato, não inferência) — cheguei a tentar validar
também clicando na UI (adicionar um rack via a aba "RACKS" e inspecionar o
elemento renderizado), mas o seletor não encontrou o botão a tempo
(timeout); não é uma segunda confirmação independente, mas a tabela já vem
direto do código-fonte deles, que é uma fonte mais forte que inferência
visual.

Tamanho da tabela: nível 0 tem 12 entradas (4 colunas × 3 linhas — bate com
`cols:8` do `room-config` real ÷ 2 células de largura por rack = 4 posições);
níveis 1-3 têm 18 entradas cada (6 colunas × 3 linhas — bate com `cols:12` ÷ 2
= 6 posições). **Esses totais (12/18/18/18) batem exatamente com a contagem
real de racks por `room_level` da conta NoID** (12/18/18 — a conta só tem 3
salas desbloqueadas), confirmando que o esquema de slots é o mesmo.

### Tabela completa — viewport `desktop`

```
roomLevel 0 (12 slots, 4 cols x 3 rows):
x=0,y=0 -> left=48,  top=289   x=1,y=0 -> left=133, top=289   x=2,y=0 -> left=228, top=289   x=3,y=0 -> left=313, top=289
x=0,y=1 -> left=408, top=289   x=1,y=1 -> left=493, top=289   x=2,y=1 -> left=588, top=289   x=3,y=1 -> left=673, top=289
x=0,y=2 -> left=228, top=439   x=1,y=2 -> left=313, top=439   x=2,y=2 -> left=408, top=439   x=3,y=2 -> left=493, top=439

roomLevel 1, 2 e 3 (18 slots cada, 6 cols x 3 rows -- MESMA tabela pros 3 níveis):
x=0,y=0 -> left=228, top=139   x=1,y=0 -> left=313, top=139   x=2,y=0 -> left=408, top=139   x=3,y=0 -> left=493, top=139   x=4,y=0 -> left=48,  top=289   x=5,y=0 -> left=133, top=289
x=0,y=1 -> left=228, top=289   x=1,y=1 -> left=313, top=289   x=2,y=1 -> left=408, top=289   x=3,y=1 -> left=493, top=289   x=4,y=1 -> left=588, top=289   x=5,y=1 -> left=673, top=289
x=0,y=2 -> left=48,  top=439   x=1,y=2 -> left=133, top=439   x=2,y=2 -> left=228, top=439   x=3,y=2 -> left=313, top=439   x=4,y=2 -> left=408, top=439   x=5,y=2 -> left=493, top=439
```

### Tabela completa — viewport `mobile`

```
roomLevel 0 (12 slots):
x=0,y=0 -> left=48,  top=289   x=1,y=0 -> left=133, top=289   x=2,y=0 -> left=228, top=289   x=3,y=0 -> left=313, top=289
x=0,y=1 -> left=48,  top=439   x=1,y=1 -> left=133, top=439   x=2,y=1 -> left=228, top=439   x=3,y=1 -> left=313, top=439
x=0,y=2 -> left=48,  top=589   x=1,y=2 -> left=133, top=589   x=2,y=2 -> left=228, top=589   x=3,y=2 -> left=313, top=589

roomLevel 1, 2 e 3 (18 slots cada -- MESMA tabela pros 3 níveis):
x=0,y=0 -> left=48,  top=139   x=1,y=0 -> left=133, top=139   x=2,y=0 -> left=228, top=139   x=3,y=0 -> left=313, top=139   x=4,y=0 -> left=48,  top=289   x=5,y=0 -> left=133, top=289
x=0,y=1 -> left=228, top=289   x=1,y=1 -> left=313, top=289   x=2,y=1 -> left=48,  top=439   x=3,y=1 -> left=133, top=439   x=4,y=1 -> left=228, top=439   x=5,y=1 -> left=313, top=439
x=0,y=2 -> left=48,  top=589   x=1,y=2 -> left=133, top=589   x=2,y=2 -> left=228, top=589   x=3,y=2 -> left=313, top=589   x=4,y=2 -> left=48,  top=739   x=5,y=2 -> left=133, top=739
```

**Achado importante**: o passo horizontal NÃO é uniforme — no desktop nível
0, de x=0 pra x=1 o `left` sobe 85px (48→133), mas depois de x=3 pra "x=0 da
próxima linha visual" o salto é bem maior (313→408 = 95px). Ou seja, **não dá
pra calcular via `left = offset + x * cellWidth`** — os valores foram
ajustados à mão pra bater com os compartimentos irregulares da estante
desenhada (madeira com larguras ligeiramente diferentes por seção). Confirma
que isso é uma tabela de lookup, não uma fórmula — não force uma fórmula na
implementação de vocês, usem lookup também (ou aceitem que só vale pra essa
arte específica do minaryganar, não pro grid abstrato do jogo real).

### Constantes auxiliares encontradas junto

```js
Ar = { desktopWidth: 720, desktopHeight: 450, mobileWidth: 360, mobileHeight: 750 }
// tamanho total do canvas da sala por viewport -- bate com window.width=720
// (a "janela" cobre a largura toda do desktop)

Br = { 0: {cols:8,rows:3}, 1: {cols:12,rows:3}, 2: {cols:12,rows:3}, 3: {cols:12,rows:3} }
// idêntico ao room_levels_config[].cols/rows do room-config REAL da NoID --
// confirma de novo (2ª fonte independente) a premissa da investigação
// anterior: essa geometria é fixa, não muda por skin.

ks = { width: 75, height: 120, shelfPitch: 32, baseLift: 10 }
Ir = { singleCellXOffset: 17, shelfPitch: 32, baseLift: 10, spriteScale: .5 }
// usadas por uma função Tt(rackHeight, minerXY, minerCellWidth) que calcula
// a posição de um MINERADOR dentro de um rack (não de um rack na sala) --
// escopo diferente do que foi pedido aqui, documentado só pra não confundir
// com a tabela Dr acima.
```

## 2. URLs de download confirmadas

O segmento de "skin" no path **não é a string "default"** nem literalmente
"room3_done" sozinho -- é o **`appearanceId` em hex**, com `room3_done` como
subpasta DENTRO dele. Testado com `curl` puro, sem autenticação:

| URL testada | Resultado |
|---|---|
| `.../room-backgrounds/room3_done/decore1.png` | ❌ HTTP 404 |
| `.../room-backgrounds/default/room3_done/decore1.png` | ❌ HTTP 404 |
| `.../room-backgrounds/60770a4665dce86c866dd720/room3_done/decore1.png` | ✅ **HTTP 200** |

**Padrão confirmado e funcional:**
```
https://api.minaryganar.com/assets/rollercoin/room-backgrounds/{appearanceId}/room3_done/{arquivo}
```

Testado com 6 arquivos diferentes (essentials, decoreN, e o window):

| Arquivo | Resultado |
|---|---|
| `room3_done/decore1_light.png` | HTTP 200, image/png, 3801 bytes |
| `room3_done/essentials/Table.png` | HTTP 200, image/png, 8456 bytes |
| `room3_done/essentials/chair.png` | HTTP 200, image/png, 3505 bytes |
| `room3_done/decore11.png` | HTTP 200, image/png, 5572 bytes |
| `room3_done/decore15.png` | HTTP 200, image/png, 3952 bytes |
| `room3_done/essentials/scy.png` | HTTP 200, image/png, 9904 bytes |

**Implicação pra arquitetura**: o `appearanceId` (hex de 24 caracteres, igual
ao formato do `appearance.id` que já vimos no `room-config` real da NoID,
`60703a4f65dce86c8632135d`) é o identificador que precisa ser lido do
`room-config` da conta pra montar a URL certa -- **não existe um path
"universal"/"default" sem esse ID**. Skins diferentes = `appearanceId`
diferentes = pastas completamente diferentes (podendo inclusive ter um
conjunto de arquivos `decoreN`/`essentials` diferente, como já vimos entre
o skin `default`/`room1_done` da investigação anterior — 50 arquivos — e
este `60770a.../room3_done` — só 18 arquivos posicionados + 24 tiles).

## Arquivos de apoio baixados (não commitados, só usados durante a investigação)

Bundle `RoomSimulatorPublicPage-EzqF4VDA.js` e os scripts de extração/curl
usados nas duas rodadas ficaram fora do controle de versão -- só este `.md`
com os dados já extraídos é o artefato permanente desta investigação.

---

# Atualização: tamanho do rack em pixels + posição do minerador dentro do rack

Investigação feita pra implementar `RoomRacksLayer` (racks + mineradores
reais por cima do fundo). O bundle re-baixado é o mesmo (`EzqF4VDA.js`,
release `20260823191520` inalterado).

## Tamanho do rack: caixa FIXA 75x120px, não escala com rack_info.width/height

Achado que contraria a suposição inicial ("width/height células × tamanho de
célula"): **não existe um "tamanho de célula" pra racks**. Confirmado por
DUAS constantes independentes no bundle com o MESMO valor:

```js
const j  = { width: 75, height: 120 }   // usada na função real de render (eo)
const ks = { width: 75, height: 120, shelfPitch: 32, baseLift: 10 }  // helper equivalente (Tt)
```

Um rack `2x3` (6 células, ex: Golden Rack 6) e um rack `2x4` (8 células, ex:
Carved North Rack 8) usam a MESMA caixa 75x120px -- o que muda é só como as
linhas de mineradores se distribuem verticalmente dentro dela (shelfPitch=32
por linha, contado de baixo pra cima), não o tamanho externo do rack.
Confirmado lendo a função de posicionamento de minerador real (`eo`), que
usa `j.width`/`j.height` como constantes fixas independente de quantas
linhas (`rackHeightCells`) o rack específico tem.

## Fórmula real de posição do minerador dentro do rack

A função `Xo` (exportada como `f` de `gameSprites-BFxy5DG-.js`, um chunk
separado que a investigação anterior tinha descartado como "só helpers
pequenos" -- era só pequeno em bytes, não em importância) faz:

```js
// gameSprites.js
function g(e, t, n, r) { return -(e - 1 - t) * n - r }
// e=rackHeightCells, t=miner.y, n=shelfPitch, r=baseLift
```

Usada em `RoomSimulatorPublicPage.js`, função `eo({miner, rackHeightCells})`:

```js
const o = minerAnchor  // {singleCellXOffset:17, shelfPitch:32, baseLift:10, spriteScale:.5}
const r = miner.width===1 ? (miner.x===0 ? -17 : o.singleCellXOffset) : 0
const a = Xo(rackHeightCells, miner.y, o.shelfPitch, o.baseLift)
const centerX = j.width/2 + r   // 37.5 + r -- ponto de ANCORAGEM horizontal (centro do sprite)
const bottomY = j.height + a    // ponto de ANCORAGEM vertical (base do sprite)
// width/height do sprite = frameWidth/frameHeight (do próprio minerador) * spriteScale (0.5)
// left = centerX - width/2 ; top = bottomY - height
```

Confirmado (não é suposição): mineradores de 1 célula usam offsets diferentes
conforme fiquem à esquerda (`x===0`, offset -17) ou à direita
(`singleCellXOffset`, +17) da linha; mineradores de 2 células (ocupam a
linha toda) ficam centralizados (offset 0). A ancoragem é
CENTRO-HORIZONTAL/BASE-INFERIOR do sprite, não canto superior esquerdo --
por isso `left`/`top` finais exigem subtrair metade da largura e a altura
inteira do ponto de ancoragem.

## Achado à parte (não é do fundo/racks, mas bloqueou a implementação): `filename` do room-config não é confiável pra montar o path da imagem do minerador

Tentativa inicial: montar a URL da imagem direto como
`/miners-icons/${miner.filename}.gif` (campo `filename` já vem no
room-config real, ex: `"captain_flint"`). **Isso quebra silenciosamente pra
nomes com apóstrofo ou "&"** -- confirmado com dado real da conta NoID: 15
de 161 mineradores (~9%) tinham imagem quebrada. Exemplos:

| `filename` do room-config | Arquivo REAL sincronizado (miners.json) |
|---|---|
| `uncles_dungeon` | `uncle_s_dungeon.gif` |
| `horizon_line` | `horizon-line.gif` (hífen, não underscore) |
| `manners_&_mayhem` | `manners_mayhem.gif` (`&` removido, não mantido) |
| `corsair’s_oath` | `corsairs_oath.gif` (apóstrofo removido) |

Correção: **não usar `filename` pra montar path nenhum** -- reaproveitado
`matchRoomMinerInstances()` (já existente em `matchMinersInventory.ts`, usado
em `/merges`), que casa cada instância de room-config contra `miners.json`
por NOME normalizado + POWER (mesma tolerância de 0.5% já estabelecida),
devolvendo o `id` do catálogo -- daí o `image` já normalizado vem direto do
catálogo, sem nenhuma lógica de slug própria. Depois da correção: 0/161
mineradores quebrados.

---

# Atualização: BUG CRÍTICO de posicionamento de rack (debug pós-Prompt 50)

O Prompt 50 passou nos testes automatizados (contagem 48/48 racks, 161/161
mineradores, 0 imagens quebradas) mas o resultado visual estava errado --
racks sobrepondo decoração, um rack até cortado pela borda do canvas numa
das salas. A contagem valida "renderizou sem crashar", não "renderizou na
posição certa" -- por isso este debug.

## Causa raiz: `cellToPixel()`/`Dr` devolve um ponto de ANCORAGEM, não o canto superior esquerdo

Achado direto no código-fonte real (função `ra`, o componente que renderiza
CADA rack individual, em `RoomSimulatorPublicPage.js`):

```js
function ra({snapshot:e, rack:t, slot:n, selected:o}) {
  return s.jsxs("div", {
    className: "absolute",
    style: {
      left: n.left - j.width/2,   // n = a entrada do slot (Dr) pra esse rack
      top:  n.top  - j.height,    // j = {width:75, height:120}
      width: j.width,
      height: j.height,
      zIndex: Math.round(n.top),
    },
    ...
  })
}
```

O `left`/`top` de cada entrada da tabela `Dr` é o ponto de **ancoragem
centro-horizontal + base-inferior** do rack -- exatamente a mesma convenção
já confirmada e documentada pra posição do MINERADOR dentro do rack
(`minerPixelBoxInRack`/`eo`/`Xo`). Não é coincidência: os dois sistemas
(rack-na-sala e minerador-no-rack) usam a mesma lógica de ancoragem, só que
na primeira investigação (Prompt 50) eu só apliquei essa conversão pro
minerador, e usei `left`/`top` do rack DIRETO como canto superior esquerdo
-- o que deslocava cada rack ~37px pra direita e 120px pra baixo da posição
real, causando a sobreposição com a decoração vista nos screenshots de
debug.

**Correção**: `left = slot.left - RACK_BOX_WIDTH_PX/2`, `top = slot.top -
RACK_BOX_HEIGHT_PX` (nova função `rackPixelBox()` em `roomLayout.ts`).
Também adicionado `zIndex: Math.round(slot.top)` por rack, confirmado no
mesmo trecho de código (racks mais "pra frente" na sala, top maior, ficam
por cima dos mais "pra trás").

## Confirmado que a DECORAÇÃO (`Ur`/`Ze`) NÃO precisa dessa conversão

Investiguei a função `Gr()` (usada pra transformar cada entrada de
`decorations` antes de virar `style`) especificamente pra não misturar os
dois sistemas por engano:

```js
function Gr(e, t, n) {
  if (n === "desktop") return { left: e.left, top: e.top }  // passthrough puro
  // (mobile faz um remapeamento de grid pra responsividade -- não usado aqui)
  ...
}
```

Em modo desktop, `Gr` é um passthrough exato -- `left`/`top` de `Ur`/`Ze` já
são o canto superior esquerdo, sem nenhuma conversão. `RoomBackground.tsx`
(Prompt 49) já fazia isso certo desde o início; o bug era só nos racks.

## Verificação visual antes/depois (dado real, conta NoID)

Sala 0 -- antes: rack esquerdo caindo em cima do tapete/planta, rack direito
em cima da estante cinza. Depois: 12 racks organizados em duas fileiras
limpas (8 numa fileira, 4 noutra), decoração visível ao redor sem
sobreposição.

Sala 1 -- antes: um rack parcialmente cortado pela borda superior do
canvas. Depois: mesmo rack aparece inteiro, dentro da área visível, 3
fileiras organizadas (4/8/6 racks).

Contagem depois da correção: continua 48/48 racks, 161/161 mineradores, 0
imagens quebradas -- a correção foi só de POSIÇÃO, não afetou quantidade
nem resolução de imagem.

---

# Atualização: tamanho do rack, 2ª rodada -- 75x120 era caixa-alvo, não o tamanho da imagem

O Prompt 51 corrigiu a posição (âncora), mas o tamanho continuava errado:
todos os racks apareciam com a MESMA proporção visual, embora um rack 2x3 e
um 2x4 devessem parecer visivelmente diferentes. Duas rodadas de
investigação até chegar na causa raiz real.

## 1ª tentativa (descartada): medir naturalWidth/naturalHeight direto

Medi os 72 arquivos reais de `public/racks-icons/*.webp` -- **todos têm o
MESMO tamanho nativo, 126x100px**, não importa se são 2x3 (6 células) ou
2x4 (8 células). Confirma que usar `naturalWidth`/`naturalHeight` direto
como tamanho final (ideia inicial) não teria resolvido nada -- o tamanho do
ARQUIVO não muda, só o quanto do canvas de 126x100 cada desenho realmente
ocupa.

## 2ª tentativa: recorte por canal alfa (`rackTrimBox.ts`)

Implementado a partir de uma descrição detalhada do algoritmo real (lido
via DevTools num print do bundle de produção, fornecido pelo usuário):
varrer o canal alfa de cada imagem (limiar >24, ~10% opacidade), achar a
bounding box do conteúdo visível, escalar essa caixa pra caber em 75x120
(`RACK_BOX_WIDTH_PX`/`RACK_BOX_HEIGHT_PX`), desenhar a imagem INTEIRA nessa
escala (não só o recorte), com `overflow:hidden` cortando o que sobra.

**Resultado real (teste isolado, Golden Rack 6 2x3 vs Green Silk 8 2x4)**:
funcionou -- proporções ficaram diferentes entre os dois, confirmando que a
lógica de recorte-e-escala estava certa em princípio. MAS a arte visível
ocupava só a metade ESQUERDA da caixa 75x120, com a direita vazia
(transparente). Achado que motivou a investigação seguinte.

## Causa raiz real: existe uma variante "game" do rack, sem precisar de recorte-por-alfa nenhum

Lendo o bundle de novo (função `Zn`, componente que decide qual imagem de
rack renderizar):

```js
function Zn({snapshot:e, rack:t}) {
  const n = Hn(e, t.rackId), o = n ? $(n) : null   // "o" = imagem do CATÁLOGO (fallback)
  const { gameSheet: i, gameFailed: l } = Qn(t.rackId)   // "i" = imagem "game" (CAMINHO PRIMÁRIO)
  if (!l) {   // !gameFailed -- caminho normal, image "game" carregou
    if (!i) return <></>
    const frameWidth = Rn(i.naturalWidth)   // Rn = função "metade" de gameSprites.js
    const box = Jn(i)
    return <SpriteFrame sheet={i} frame={0} frameWidth={frameWidth} style={box} />
  }
  // só chega aqui se gameFailed=true -- ENTÃO cai no recorte-por-alfa sobre "o"
  ...
}
```

`Qn(rackId)` carrega `rollercoin/racks/game/{rackId}.png` -- **um path
PÚBLICO, sem autenticação** (mesmo padrão já confirmado pra mineradores,
`rollercoin/miners/game/{slug}.png`). Testei com `curl` puro, 13/13 tipos
de rack da conta NoID respondem HTTP 200. O recorte-por-alfa
(`rackTrimBox.ts`) só roda no `else` -- fallback pra quando esse arquivo
"game" falha ao carregar, não é o caminho principal.

### Por que a imagem "game" resolve o problema sem recorte

Baixei e medi a imagem "game" de 6 racks reais (3 racks 2x3, 3 racks 2x4):

| Rack | células | naturalWidth | naturalHeight |
|---|---|---|---|
| Golden Rack 6 | 2x3 | 300 | 176 |
| Neon Rack 6 | 2x3 | 300 | 176 |
| Trophy Rack 6 | 2x3 | 300 | 180 |
| Green Silk 8 | 2x4 | 300 | 240 |
| Carved North Rack 8 | 2x4 | 300 | 240 |
| Trophy Rack 8 | 2x4 | 300 | 244 |

**Largura nativa sempre 300px, independente do número de células -- só a
ALTURA varia com o número de linhas.** Visualmente confirmado abrindo os
PNGs: é um spritesheet de 2 ESTADOS lado a lado (normal | selecionado,
150px cada), e cada estado já mostra o número CERTO de prateleiras (3
pra um rack 2x3, 4 pra um 2x4) -- a proporção que faltava já vem pronta
na própria imagem, sem precisar calcular nada por canal alfa.

### Fórmula real (função `Jn` do bundle)

```js
function Jn(e) {
  const n = Rn(e.naturalWidth) * se   // Rn=metade, se=0.5 -- frameWidth = naturalWidth/4
  const o = e.naturalHeight * se       // frameHeight = naturalHeight/2
  const r = j.width/2 - n/2            // left: centralizado horizontalmente
  const a = j.height - o               // top: ancorado na base (mesma convenção de sempre)
  return { left:r, top:a, width:n, height:o, right:r+n, bottom:a+o }
}
```

Pra Golden Rack 6 (300x176): frameWidth=75 (=RACK_BOX_WIDTH_PX exato),
frameHeight=88, top=120-88=32 (fica ancorado na base, com 32px vazios
acima -- mesma lógica de racks mais curtos "afundarem" na caixa fixa, já
documentada pro posicionamento de minerador). Pra Green Silk 8 (300x240):
frameHeight=120 (preenche a caixa toda), top=0.

## Implementação final

- `src/utils/rackGameSpriteBox` (em `roomLayout.ts`): implementa a fórmula
  acima.
- `scripts/sync-rack-game-sprites.js`: sincroniza
  `rollercoin/racks/game/{rackId}.png` pra
  `public/racks-game-icons/{rackId}.png`, mesmo padrão idempotente dos
  outros scripts. 72/72 racks do catálogo sincronizados com sucesso.
- `RackImage` (em `RoomRacksLayer.tsx`): tenta o sprite "game" primeiro
  (recorta só o estado "normal", metade esquerda, via wrapper com
  `overflow:hidden`); se a imagem falhar ao carregar (`onError`), cai no
  fallback de recorte-por-alfa (`rackTrimBox.ts` + catálogo `.webp`) --
  mesma estrutura de fallback do bundle real.
- `rackTrimBox.ts` e o array `Is`/`Ds` de crop-boxes por exceção
  documentados anteriormente continuam válidos, só que agora como
  FALLBACK, não caminho principal.

## Verificação com dado real (conta NoID)

Testado com a conta real -- 48/48 racks renderizados, TODOS os 48 usando o
caminho primário (sprite "game", 0 caíram no fallback), 0 imagens
quebradas. Contagem de mineradores mudou pra 209 (era 161 -- o usuário
alterou a composição de racks/mineradores da conta manualmente entre
sessões, não é bug). Visualmente: cada rack agora preenche a caixa 75x120
inteira com o número certo de prateleiras (3 ou 4 conforme as células),
nada de área vazia/transparente como na tentativa de recorte-por-alfa.

Observação menor, não investigada a fundo (não bloqueante): uma linha
verde fina de ~1px aparece na borda direita de vários racks nos
screenshots -- possível resquício do "estado selecionado" (borda verde) do
spritesheet vazando por arredondamento de subpixel no recorte. Não afeta a
legibilidade/proporção geral; fica registrado aqui como possível
refinamento futuro.

---

# Atualização: bug real "rack partido em duas metades" -- não era a ancoragem, era o preflight do Tailwind

Depois do Prompt 53, o rack parecia mostrar os 2 estados do spritesheet
(normal + selecionado) lado a lado dentro da mesma caixa, em vez de só o
"normal" recortado -- como se a imagem tivesse sido "espremida" na
largura. A suspeita inicial (erro de sinal na ancoragem centro-horizontal)
estava errada -- a ancoragem sempre esteve certa.

## Causa raiz: `img { max-width: 100% }` do preflight do Tailwind

O `<img>` do rack é renderizado com `width: 150px` inline (frameWidth*2 --
os 2 estados lado a lado), dentro de um wrapper com `width: 75px` +
`overflow:hidden` (só o estado "normal", à esquerda, devia ficar visível).
**O preflight do Tailwind aplica `img, video { max-width: 100%; height:
auto }` por padrão em qualquer `<img>`** -- isso CAPA a largura renderizada
no `max-width` do elemento em si (100% = 75px, herdado do wrapper), MESMO
com `width:150px` definido inline. `max-width` sempre vence sobre `width`
explícito quando o valor de `width` excede o `max-width` -- não é uma
questão de especificidade CSS normal.

Resultado: o navegador comprimia a imagem NATIVA INTEIRA (300px, os 2
estados) pra caber em 75px, em vez de mostrar só os primeiros 75px
(1 estado) cortados pelo `overflow:hidden` -- por isso os 2 estados
apareciam espremidos lado a lado dentro da mesma caixa, parecendo "imagem
partida ao meio".

Confirmado com dado real via `getBoundingClientRect()`: o `<img>` tinha
`style="width:150px"` mas `rect.width` relatava `75` -- a prova direta do
cap do `max-width`.

**Correção**: adicionar a classe `max-w-none` (Tailwind, `max-width:none`)
em TODOS os `<img>` posicionados com largura explícita que pode exceder o
container -- aplicado nos dois caminhos de `RackImage` (game sprite +
fallback alpha-trim) e preventivamente em `RoomBackground.tsx` (nenhuma
decoração excede o container hoje, mas evita a mesma classe de bug se
mudar). O próprio bundle do minaryganar já usa `max-w-none` explicitamente
nas classes dos `<img>` dele -- eu tinha visto isso numa investigação
anterior mas não tinha entendido a razão até bater nesse bug de verdade.

## Bug relacionado (efeito colateral da sala responsiva): overflow horizontal da página inteira

Ao tornar a sala responsiva (escala via `transform:scale()` calculado por
`ResizeObserver`, pra usar a largura real disponível em vez de 720px fixos
-- ver `ScaledRoomCanvas.tsx`), a página inteira ganhou scroll horizontal
em telas mais estreitas (`document.body.scrollWidth` > `clientWidth`).

Causa: `<main className="flex-1 p-8">` em `Layout.tsx` não tinha
`min-w-0`. Item flex sem `min-w-0` tem largura mínima igual ao conteúdo
mais largo dentro dele (`min-width:auto` é o padrão CSS pra item flex) --
nenhuma outra página tinha um descendente largo o suficiente (720px fixos
antes de escalar) pra expor isso antes da sala virar responsiva.
Correção: `<main className="min-w-0 flex-1 p-8">`.

---

# Atualização: ordem da janela/céu no array de decoração + tamanho real do minerador

## 1. Bug de ordem: `essentials_scy.png` (janela/céu) tava por ÚLTIMO no array

`public/data/roomBackgroundLayout.json` -- na Sala 0, `essentials_scy.png`
(a janela/céu, `left:0,top:0,width:720,height:100`) foi transcrito por
ÚLTIMO no array, DEPOIS de `essentials_trophy_shelf`/`essentials_chair`/
`essentials_Table` (todos também em `top:0`, mesma faixa vertical). Como
nenhum item de decoração tem z-index (confirmado: `RoomBackground.tsx`
nunca aplicou nenhum), ordem do array = ordem de pintura -- o céu, por
vir depois, cobria a estante/cadeira/mesa.

Confirmado com cálculo real (não só suposição): pra Salas 1-3, a fileira
superior de racks (`y=0`, `x=0..3`) genuinamente sobrepõe espacialmente a
área do céu (rack box top:19-139 vs céu top:0-100 -- 6075px² de
sobreposição real por rack, 4 racks afetados). Isso NÃO chegava a cortar
racks/miners visualmente porque eles têm z-index numérico explícito
(`Math.round(slot.top)`, sempre positivo) e decoração não tem nenhum --
por regra de pintura CSS (CSS2.1 Apêndice E), um z-index positivo explícito
sempre pinta por cima de qualquer elemento com z-index:auto, não importa a
ordem no DOM. Mas a ORDEM entre elementos de decoração ENTRE SI (sem
z-index nenhum, todos "auto") segue ordem de array pura -- por isso só a
janela cobria a mobília, não os racks.

**Correção**: mover `essentials_scy.png` pro INÍCIO de cada array (`sala0`
e `salas1a3`) -- janela como fundo, decoração por cima, mesma ordem
"tiles primeiro" que se aplicaria se tivéssemos uma camada de tiles
separada (não temos, é tudo um array só).

## 2. Tamanho do minerador -- fórmula errada usada até aqui

Achado que EXIGIU reabrir o bundle: a nota antiga deste doc (`As =
{width:126,height:100} // provável tamanho de célula renderizada de
miner`) era um CHUTE do início da investigação, nunca confirmado -- e
estava ERRADO. `As` acabou sendo (achado numa rodada posterior, já
documentada acima) só um fallback de CARREGAMENTO de imagem de RACK, sem
nenhuma relação com o tamanho final de minerador.

A função real (`eo`, `RoomSimulatorPublicPage.js`) tem DUAS branches:

- **Branch "sheet"** (spritesheet com múltiplos frames de animação,
  carregado via `ne(c)`/`Ee(c)` por filename): usa `frameWidth`/
  `frameHeight` do PRÓPRIO minerador escalados por `spriteScale` -- era a
  fórmula que eu tinha implementado, mas essa branch depende de um asset
  que não é o `.gif` público que `miners.json` expõe.
- **Branch de fallback GIF** (`miners/{filename}.gif`, ativada quando o
  "sheet" falha) -- **é a que bate com o que a gente usa de verdade**, já
  que `miners.json`/`public/miners-icons/*.gif` são exatamente esse tipo
  de asset:

  ```js
  nn = {width:126, height:100}   // constante DISTINTA de As, confirmada por busca direta
  T = nn.width * spriteScale      // largura renderizada -- CONSTANTE, igual pra todo minerador
  E = miner.frameHeight ?? 50
  _ = (nn.height - E) / 2 * spriteScale   // offset de centralização vertical
  // <img> final:
  style: {
    width: T,                 // não escala com o frameWidth do minerador!
    left: i - T/2,             // i = centro-x do minerador (mesmo de sempre)
    top: l + _,                 // l = base-y do minerador (mesmo de sempre)
    transform: "translateY(-100%)",  // ancora pela base usando a altura NATURAL (auto) da imagem
  }
  // altura NÃO é setada explicitamente -- fica "auto" (proporção natural do .gif)
  ```

Ou seja: a largura final é uma CONSTANTE (63px = 126×0.5) igual pra
qualquer minerador -- só a POSIÇÃO vertical varia por minerador (via `_`,
que depende do `frameHeight` dele), e a ALTURA fica livre pra proporção
natural da imagem em vez de forçada. Isso é bem diferente do que eu tinha
implementado antes (width E height escalados por frameWidth/frameHeight do
próprio minerador, ambos setados explicitamente) -- corrigido em
`minerPixelBoxInRack` (`roomLayout.ts`) e no render (`RoomRacksLayer.tsx`,
agora sem wrapper de altura fixa, `<img>` direto com `transform:
translateY(-100%)`).

## Verificação com dado real (conta NoID, 3 salas desbloqueadas)

48/48 racks, 209/209 mineradores, 0 imagens quebradas, 0 overflow de
página. Confirmado visualmente: móveis aparecem por cima do céu/parede
(screenshot isolado só de fundo, sem racks); racks/miners não cortados
mesmo nas posições com sobreposição espacial real (fileira superior de
Salas 1-3); mineradores de tipos diferentes (zoom 2.5x, ~5 tipos)
comparados lado a lado mostram proporção consistente entre si, preenchendo
boa parte da altura da prateleira -- muito mais próximo da referência que
a versão anterior (mineradores minúsculos/desproporcionais).

---

# Atualização: upscale indevido da sala + miner cortada no topo do rack

## 1. `ScaledRoomCanvas` fazia upscale em telas largas

O `scale` calculado por `ResizeObserver` (`width / ROOM_WIDTH`) não tinha
teto -- em telas largas (`largura disponível > 720px`), a sala era
esticada MAIOR que o tamanho nativo, borrando os sprites de pixel art.
Corrigido com `Math.min(1, width / ROOM_WIDTH)`.

Isso sozinho não bastava: o container externo (`w-full` + `aspect-ratio`)
continuava do tamanho do espaço disponível mesmo com o conteúdo escalado
pra baixo, sobrando área vazia ao redor. Reestruturado em dois divs: um
"de medição" (sempre `w-full`, só pra o `ResizeObserver` continuar
detectando mudança de espaço disponível) e um "de tamanho real"
(`width/height` explícitos = `ROOM_WIDTH/HEIGHT * scale`, já capado) que
efetivamente ocupa só o espaço do conteúdo escalado.

## 2. Miner cortada no topo do rack -- `overflow:hidden` no slot errado

O container do SLOT (a caixa 75x120 de cada rack, em `RoomRacksLayer.tsx`)
tinha `overflow:hidden` -- usado originalmente pra cortar a imagem do rack
(que costuma extrapolar a caixa). Só que isso também cortava miners
ancoradas com `transform:translateY(-100%)` (fórmula real, Prompt 55) que
ultrapassam o topo do slot -- comportamento ESPERADO no jogo real (miners
"vazam" pra cima da prateleira), não um bug a esconder.

Correção: cada caminho de imagem de RACK agora recorta A SI MESMO num
wrapper próprio (o caminho "game sprite" já fazia isso; adicionado o mesmo
padrão no caminho de fallback alpha-trim, que antes dependia do overflow
do slot pai) -- o slot em si não precisa mais de `overflow:hidden`
nenhum. z-index por posição (`Math.round(slot.top)`, já implementado)
continua garantindo a ordem de sobreposição certa entre racks de linhas
diferentes.

## Verificação com dado real (conta NoID)

Viewport largo (1920px): sala renderiza a exatos 720px, nunca mais.
Viewport estreito (900px): sala encolhe pra 502px, continua funcionando.
48/48 racks, 209/209 mineradores, 0 quebrados, 0 overflow nas 3 salas
desbloqueadas. Zoom na fileira superior de Sala 0 e Sala 1 (a última é
onde há sobreposição espacial real com o céu, já confirmada antes) --
nenhuma miner cortada em nenhuma das duas.
