import { useState } from 'react'
import Card from '../components/Card'

const SESSION_KEY = 'rlc_admin_password'

type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'success'; eventName: string; savedAt: Date }
  | { status: 'error'; message: string }

function readStoredPassword(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}

export default function Admin() {
  const [password, setPassword] = useState(() => readStoredPassword())
  const [passwordInput, setPasswordInput] = useState('')
  const [jsonInput, setJsonInput] = useState('')
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' })

  function handleLogin() {
    if (!passwordInput) return
    try {
      sessionStorage.setItem(SESSION_KEY, passwordInput)
    } catch {
      // sessionStorage indisponível (modo privado etc.) -- segue só em memória
    }
    setPassword(passwordInput)
    setPasswordInput('')
    setSaveState({ status: 'idle' })
  }

  function handleLogout() {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      // ignora
    }
    setPassword(null)
  }

  async function handleSave() {
    if (!password) return

    let event: unknown
    try {
      event = JSON.parse(jsonInput)
    } catch {
      setSaveState({ status: 'error', message: 'JSON inválido -- confira a sintaxe antes de salvar.' })
      return
    }

    setSaveState({ status: 'saving' })

    try {
      const response = await fetch(`${import.meta.env.VITE_PROXY_URL}/api/progression-data/current`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, event }),
      })

      if (response.status === 401) {
        handleLogout()
        setSaveState({ status: 'error', message: 'Senha incorreta. Faça login novamente.' })
        return
      }

      if (response.status === 400) {
        const body = await response.json().catch(() => null)
        const missing = Array.isArray(body?.missing) ? body.missing.join(', ') : 'desconhecido'
        setSaveState({
          status: 'error',
          message: `Dados do evento incompletos. Campos faltando: ${missing}`,
        })
        return
      }

      if (!response.ok) {
        setSaveState({
          status: 'error',
          message: `Erro inesperado do servidor (${response.status}).`,
        })
        return
      }

      const eventName =
        event && typeof event === 'object' && 'name' in event
          ? String((event as { name: unknown }).name)
          : '(sem nome)'

      setSaveState({ status: 'success', eventName, savedAt: new Date() })
    } catch (err) {
      console.error('Falha ao salvar evento em /api/progression-data/current:', err)
      setSaveState({
        status: 'error',
        message: 'Erro de rede -- não foi possível contatar o servidor.',
      })
    }
  }

  if (!password) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-white">Admin</h1>
        <div className="mt-4 max-w-sm">
          <Card title="Login">
            <div className="space-y-3">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Senha"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleLogin}
                className="w-full rounded-md bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-500"
              >
                Entrar
              </button>
              {saveState.status === 'error' && (
                <p className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
                  {saveState.message}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Admin</h1>
        <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-slate-200">
          Sair
        </button>
      </div>

      <div className="mt-4 max-w-2xl">
        <Card title="Atualizar Evento Atual">
          <div className="space-y-3">
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="Cole o JSON do evento aqui"
              rows={16}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleSave}
              disabled={saveState.status === 'saving' || !jsonInput}
              className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveState.status === 'saving' ? 'Salvando...' : 'Salvar Evento'}
            </button>

            {saveState.status === 'error' && (
              <p className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
                {saveState.message}
              </p>
            )}

            {saveState.status === 'success' && (
              <p className="rounded-md border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300">
                Evento "{saveState.eventName}" salvo com sucesso em{' '}
                {saveState.savedAt.toLocaleString('pt-BR')}.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
