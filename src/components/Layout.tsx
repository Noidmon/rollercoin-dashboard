import type { ReactNode } from 'react'
import Sidebar from './Sidebar'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <Sidebar />
      {/* min-w-0: sem isso, flex-1 não deixa <main> encolher abaixo do
          conteúdo mais largo dentro dele (min-width:auto é o padrão de
          item flex) -- só ficou visível com a sala de /simulador (720px
          fixos antes de escalar), causando overflow horizontal da página
          inteira. Nenhuma outra página tinha um descendente largo o
          suficiente pra expor isso antes. */}
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  )
}
