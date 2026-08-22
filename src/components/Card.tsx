import type { ReactNode } from 'react'

export default function Card({
  title,
  children,
  className = '',
  contentClassName = '',
}: {
  title: string
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <div className={`rounded-lg border border-slate-800 bg-slate-900 p-5 ${className}`}>
      <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
        {title}
      </h2>
      <div className={`mt-3 ${contentClassName}`}>{children}</div>
    </div>
  )
}
