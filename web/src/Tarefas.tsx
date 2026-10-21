import { useCallback, useEffect, useRef, useState } from 'react'
import {
  atualizarTarefa,
  criarTarefa,
  deletarTarefa,
  listarTarefas,
  type Tarefa,
  type Usuario,
} from './api'

type Prioridade = Tarefa['prioridade']
type Status = Tarefa['status']

const PRIORIDADES_PT: Record<Prioridade, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}
const PRIORIDADES: Prioridade[] = ['low', 'medium', 'high']
const COR_PRIORIDADE: Record<Prioridade, string> = {
  low: 'bg-slate-700/60 text-slate-300 ring-slate-600',
  medium: 'bg-amber-500/15 text-amber-300 ring-amber-500/40',
  high: 'bg-rose-500/15 text-rose-300 ring-rose-500/40',
}
const DEBOUNCE_MS = 400

function mensagemDe(erro: unknown, padrao: string): string {
  return erro instanceof Error ? erro.message : padrao
}

interface TarefasProps {
  usuario: Usuario
  aoSair: () => void
}

export default function Tarefas({ usuario, aoSair }: TarefasProps) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [titulo, setTitulo] = useState('')
  const [prioridade, setPrioridade] = useState<Prioridade>('medium')
  const [criando, setCriando] = useState(false)
  const [paraExcluir, setParaExcluir] = useState<Tarefa | null>(null)

  const requisicaoAtual = useRef(0)
  const ultimaBusca = useRef('')
  const botaoConfirmar = useRef<HTMLButtonElement>(null)

  const aindaValida = useCallback(
    (meuId: number): boolean => meuId === requisicaoAtual.current,
    [],
  )

  const carregar = useCallback(async (): Promise<void> => {
    const meuId = ++requisicaoAtual.current
    setCarregando(true)
    try {
      const dados = await listarTarefas(buscaAplicada)
      if (!aindaValida(meuId)) return
      setTarefas(dados)
      setErro('')
    } catch (e) {
      if (!aindaValida(meuId)) return
      setErro(mensagemDe(e, 'Não foi possível carregar suas tarefas.'))
    } finally {
      if (aindaValida(meuId)) setCarregando(false)
    }
  }, [buscaAplicada, aindaValida])

  // Espera 400 ms após a última tecla antes de aplicar o filtro.
  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      const termo = busca.trim()
      if (termo === ultimaBusca.current) return
      ultimaBusca.current = termo
      setBuscaAplicada(termo)
      setCarregando(true)
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(temporizador)
  }, [busca])

  // Busca inicial e novas buscas. Respostas antigas são descartadas.
  useEffect(() => {
    const meuId = ++requisicaoAtual.current
    let montado = true

    listarTarefas(buscaAplicada).then(
      (dados) => {
        if (!montado || !aindaValida(meuId)) return
        setTarefas(dados)
        setErro('')
        setCarregando(false)
      },
      (e: unknown) => {
        if (!montado || !aindaValida(meuId)) return
        setErro(mensagemDe(e, 'Não foi possível carregar suas tarefas.'))
        setCarregando(false)
      },
    )

    return () => {
      montado = false
    }
  }, [buscaAplicada, aindaValida])

  const criar = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    const tituloLimpo = titulo.trim()
    if (tituloLimpo.length < 3) {
      setErro('O título precisa ter ao menos 3 caracteres.')
      return
    }

    setCriando(true)
    setErro('')
    try {
      await criarTarefa(tituloLimpo, prioridade)
      setTitulo('')
      setPrioridade('medium')
      await carregar()
    } catch (e) {
      setErro(mensagemDe(e, 'Não foi possível criar a tarefa.'))
    } finally {
      setCriando(false)
    }
  }

  const alternarStatus = async (tarefa: Tarefa): Promise<void> => {
    const novoStatus: Status = tarefa.status === 'completed' ? 'pending' : 'completed'
    setErro('')
    try {
      await atualizarTarefa(tarefa.id, { status: novoStatus })
      await carregar()
    } catch (e) {
      setErro(mensagemDe(e, 'Não foi possível atualizar a tarefa.'))
    }
  }

  const confirmarExcluir = async (): Promise<void> => {
    if (!paraExcluir) return
    const alvo = paraExcluir
    setParaExcluir(null)
    setErro('')
    try {
      await deletarTarefa(alvo.id)
      await carregar()
    } catch (e) {
      setErro(mensagemDe(e, 'Não foi possível excluir a tarefa.'))
    }
  }

  useEffect(() => {
    if (paraExcluir) botaoConfirmar.current?.focus()
  }, [paraExcluir])

  useEffect(() => {
    if (!paraExcluir) return
    const aoTeclar = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setParaExcluir(null)
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [paraExcluir])

  const total = tarefas.length
  const concluidas = tarefas.filter((t) => t.status === 'completed').length
  const pendentes = total - concluidas

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Minhas Tarefas</h1>
          <p className="mt-1 text-sm text-slate-400">
            Conectado como <span className="text-slate-200">{usuario.email}</span>
          </p>
        </div>
        <button type="button" onClick={aoSair} className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white">
          Sair
        </button>
      </header>

      <form onSubmit={criar} className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="titulo" className="sr-only">Título da nova tarefa</label>
          <input id="titulo" type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="O que precisa ser feito?" maxLength={120} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none" />
        </div>
        <div>
          <label htmlFor="prioridade" className="sr-only">Prioridade</label>
          <select id="prioridade" value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)} className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-slate-500 focus:outline-none sm:w-auto">
            {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIORIDADES_PT[p]}</option>)}
          </select>
        </div>
        <button type="submit" disabled={criando} className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:opacity-50">
          {criando ? 'Criando...' : 'Adicionar'}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <label htmlFor="busca" className="text-sm font-medium text-slate-300">Buscar por título</label>
        <input id="busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite para filtrar..." className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none" />
      </div>

      {erro && (
        <div role="alert" className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <span>{erro}</span>
          <div className="flex shrink-0 gap-3">
            <button type="button" onClick={() => void carregar()} className="underline hover:text-white">Tentar novamente</button>
            <button type="button" onClick={() => setErro('')} aria-label="Fechar aviso" className="text-rose-300 transition hover:text-white">×</button>
          </div>
        </div>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <p aria-live="polite" role="status" className="mb-3 text-sm text-slate-400">
          {carregando ? 'Carregando...' : `${pendentes} pendente(s) e ${concluidas} concluída(s).`}
        </p>
        {carregando ? (
          <p className="py-6 text-center text-sm text-slate-500">Buscando suas tarefas...</p>
        ) : total === 0 ? (
          <div className="py-10 text-center">
            <p className="text-slate-300">{buscaAplicada ? `Nenhuma tarefa contém "${buscaAplicada}".` : 'Nenhuma tarefa por aqui ainda.'}</p>
            <p className="mt-1 text-sm text-slate-500">{buscaAplicada ? 'Tente outro termo de busca.' : 'Use o formulário acima para criar a primeira.'}</p>
          </div>
        ) : (
          <ul className="flex max-h-[60vh] list-none flex-col gap-2 overflow-y-auto p-0 pr-1">
            {tarefas.map((t) => {
              const feita = t.status === 'completed'
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${feita ? 'text-slate-500 line-through' : 'text-slate-100'}`}>{t.titulo}</p>
                    <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ring-1 ${COR_PRIORIDADE[t.prioridade]}`}>{PRIORIDADES_PT[t.prioridade]}</span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => void alternarStatus(t)} className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white">
                      {feita ? 'Reabrir' : 'Concluir'}
                    </button>
                    <button type="button" onClick={() => setParaExcluir(t)} className="rounded border border-rose-500/40 px-3 py-1 text-xs text-rose-300 transition hover:border-rose-400 hover:text-rose-200">
                      Excluir
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {paraExcluir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setParaExcluir(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="titulo-modal" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
            <h2 id="titulo-modal" className="text-lg font-semibold text-white">Excluir esta tarefa?</h2>
            <p className="mt-2 text-sm text-slate-400"><span className="text-slate-200">{paraExcluir.titulo}</span> será removida permanentemente. Não dá para desfazer.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setParaExcluir(null)} className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white">Cancelar</button>
              <button ref={botaoConfirmar} type="button" onClick={() => void confirmarExcluir()} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500">Confirmar exclusão</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
