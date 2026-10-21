import { useState } from 'react'
import Login from './Login'
import { clearToken, getUsuario, type Usuario } from './api'

export default function App() {
  // A função inicial é executada uma vez para recuperar uma sessão existente.
  const [usuario, setUsuario] = useState<Usuario | null>(() => getUsuario())
  const logado = usuario !== null

  const aoLogar = (): void => {
    setUsuario(getUsuario())
  }

  const aoSair = (): void => {
    clearToken()
    setUsuario(null)
  }

  if (!logado || !usuario) {
    return <Login aoLogar={aoLogar} />
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-emerald-950 text-3xl text-emerald-400">
          ✓
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Login realizado
        </p>
        <h1 className="break-words text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Bem-vindo, {usuario.email}!
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Sua autenticação está funcionando. A lista de tarefas conectada ao CRUD será desenvolvida na próxima aula.
        </p>
        <button
          type="button"
          onClick={aoSair}
          className="mt-7 rounded-md border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white"
        >
          Sair
        </button>
      </section>
    </main>
  )
}
