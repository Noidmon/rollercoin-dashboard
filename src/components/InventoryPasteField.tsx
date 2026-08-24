// Campo de colar inventário, dentro do painel de stats da sala (Simulador)
// -- logo abaixo de "Bônus de Sets", por pedido explícito (Prompt 58,
// correção 1). Só a UI de colar; o resultado (busca/ordenação/filtro/
// paginação) renderiza em RoomInventoryPanel, abaixo da sala, alimentado
// pelo mesmo estado via useMinersInventoryImport.
export default function InventoryPasteField({
  pasteText,
  onPasteTextChange,
  onImport,
  unrecognizedCount,
  recognizedCount,
}: {
  pasteText: string
  onPasteTextChange: (value: string) => void
  onImport: () => void
  unrecognizedCount: number | null
  recognizedCount: number
}) {
  return (
    <div className="border-t border-slate-800 pt-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">Inventário</p>
      <label className="mb-1 mt-1.5 block text-[11px] text-slate-500">
        Colar inventário de mineradores
      </label>
      <textarea
        value={pasteText}
        onChange={(e) => onPasteTextChange(e.target.value)}
        placeholder="Cole aqui"
        rows={5}
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 font-mono text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="button"
        onClick={onImport}
        className="mt-2 w-full rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
      >
        Importar Inventário
      </button>
      {unrecognizedCount !== null && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          {recognizedCount} reconhecidos, {unrecognizedCount} não reconhecidos
        </p>
      )}
    </div>
  )
}
