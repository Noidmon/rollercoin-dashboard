import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SortDropdownOption<T extends string> {
  value: T
  label: string
}

// Largura do painel aberto -- mesma constante usada tanto no CSS (w-64
// abaixo) quanto no cálculo de posição do portal, pra nunca dessincronizar.
const PANEL_WIDTH_PX = 256

export default function SortDropdown<T extends string>({
  options,
  value,
  onChange,
  // Opcional -- permite forçar o botão a ocupar a largura do container
  // (ex: "w-full truncate") em espaços estreitos como o painel de stats do
  // Simulador, sem afetar os outros usos (Merges, Mineradores, etc, que
  // continuam com a largura natural pelo conteúdo).
  buttonClassName = '',
}: {
  options: SortDropdownOption<T>[]
  value: T
  onChange: (value: T) => void
  buttonClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Bug real corrigido (Prompt 77): o painel aberto era um filho `absolute`
  // do MESMO wrapper `relative` do botão -- se esse wrapper estiver dentro
  // de um ancestral com `overflow-x-auto` (ex: a barra de ferramentas do
  // Inventário Importado e do modal "Adicionar Item Hipotético", as duas
  // com scroll horizontal de propósito pra telas estreitas), o CSS força
  // overflow-y a computar como 'auto' também (regra do spec: se um eixo é
  // 'visible' e o outro não, o 'visible' vira 'auto') -- cortando/scrollando
  // o painel aberto em vez de deixar ele estourar visualmente pra baixo.
  // Mesma CLASSE de bug do seletor de troca do modal de rack (Prompt 74),
  // causa raiz diferente (lá era altura 0 por `inset-0`, aqui é clipping por
  // overflow do ancestral) -- corrigido na ORIGEM (este componente
  // compartilhado, usado também em Merges/Mineradores/AutoOptimizerControls)
  // via portal pra document.body, posicionado por coordenadas calculadas do
  // botão -- imune a QUALQUER overflow/clipping de ancestral, presente ou
  // futuro, em vez de depender de cada container que usa o dropdown nunca
  // ter overflow não-visible.
  //
  // Abrir pra cima quando não há espaço embaixo (Prompt 78): calcula em
  // DUAS passadas -- a 1a (painel ainda não montado, panelRef.current
  // null) sempre abre pra baixo por segurança; assim que o painel entra no
  // DOM, uma 2a passada remede a altura REAL (getBoundingClientRect, não
  // uma estimativa por nº de opções) e corrige pra cima se não couber
  // embaixo E houver mais espaço em cima. As duas passadas rodam dentro do
  // mesmo ciclo de commit síncrono (useLayoutEffect, antes do paint), sem
  // flicker visível. O guard em computePosition (só chama setPosition se o
  // valor mudou de verdade) evita loop infinito entre as passadas.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return

    function computePosition() {
      const rect = buttonRef.current!.getBoundingClientRect()
      const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 0
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const openUp = panelHeight > 0 && spaceBelow < panelHeight + 8 && spaceAbove > spaceBelow

      const top = openUp ? rect.top - panelHeight - 4 : rect.bottom + 4
      const left = Math.max(8, rect.right - PANEL_WIDTH_PX)

      setPosition((prev) =>
        prev && Math.abs(prev.top - top) < 1 && Math.abs(prev.left - left) < 1 ? prev : { top, left },
      )
    }

    computePosition()
    window.addEventListener('scroll', computePosition, true)
    window.addEventListener('resize', computePosition)
    return () => {
      window.removeEventListener('scroll', computePosition, true)
      window.removeEventListener('resize', computePosition)
    }
  }, [open, position])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeOption = options.find((o) => o.value === value)

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:text-white ${buttonClassName}`}
      >
        <span className={buttonClassName.includes('truncate') ? 'truncate' : ''}>{activeOption?.label}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[60] w-64 overflow-hidden rounded-md border border-slate-700 bg-slate-800 shadow-lg"
            style={{ top: position.top, left: position.left }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${
                  option.value === value
                    ? 'bg-indigo-500/20 text-indigo-300'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span>{option.label}</span>
                {option.value === value && <span>✓</span>}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
