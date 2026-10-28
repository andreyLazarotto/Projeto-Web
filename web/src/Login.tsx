import { useState } from 'react'
import { login, registrar } from './api'

interface LoginProps {
  aoLogar: () => void
}

type Modo = 'login' | 'registro'

export default function Login({ aoLogar }: LoginProps) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [modo, setModo] = useState<Modo>('login')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const ehLogin = modo === 'login'

  const validar = (): string => {
    if (!email.trim()) return 'Informe o e-mail.'
    if (!email.includes('@')) return 'Informe um e-mail válido.'
    if (!senha) return 'Informe a senha.'
    if (modo === 'registro' && senha.length < 6) {
      return 'A senha deve ter pelo menos 6 caracteres.'
    }
    return ''
  }

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErro('')

    const problema = validar()
    if (problema) {
      setErro(problema)
      return
    }

    setCarregando(true)
    try {
      if (ehLogin) {
        await login(email.trim(), senha)
      } else {
        await registrar(email.trim(), senha)
        await login(email.trim(), senha)
      }
      aoLogar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao autenticar.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-black text-white">
            GT
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Gerenciador de Tarefas
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {ehLogin ? 'Entre para continuar' : 'Crie sua conta para começar'}
          </p>
        </div>

        <form onSubmit={enviar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-300">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
              required
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2.5 text-base text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="senha" className="text-sm font-medium text-slate-300">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={ehLogin ? 'Sua senha' : 'Mínimo de 6 caracteres'}
              autoComplete={ehLogin ? 'current-password' : 'new-password'}
              required
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2.5 text-base text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {erro && (
            <p
              role="alert"
              className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300"
            >
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="rounded-md bg-emerald-600 py-2.5 font-semibold text-white transition hover:bg-emerald-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregando ? 'Aguarde...' : ehLogin ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setModo(ehLogin ? 'registro' : 'login')
            setErro('')
          }}
          className="mt-5 w-full text-sm text-slate-400 transition hover:text-white"
        >
          {ehLogin ? 'Não tem conta? Registre-se' : 'Já tem conta? Entrar'}
        </button>
      </section>
    </main>
  )
}
