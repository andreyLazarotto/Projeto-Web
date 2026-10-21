import { useEffect, useState } from 'react'

type Tarefa = { id: number; titulo: string }

const API_BASE = 'http://localhost:3000'

function Saudacao() {
  return <h1>Olá, turma! Minha primeira interface React!</h1>
}

export default function App() {
  const [n, setN] = useState(0)
  const [mensagem, setMensagem] = useState('Carregando...')
  const [tarefas] = useState<Tarefa[]>([
    { id: 1, titulo: 'Configurar Vite e React' },
    { id: 2, titulo: 'Entender useState e useEffect' },
    { id: 3, titulo: 'Renderizar lista com map()' },
  ])

  useEffect(() => {
    let ativo = true
    fetch(`${API_BASE}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error('Resposta inválida da API')
        return res.json()
      })
      .then((data) => {
        console.log('Dados recebidos do back-end:', data)
        if (ativo) setMensagem('Conexão estabelecida com sucesso!')
      })
      .catch((err: unknown) => {
        console.error('Falha ao conectar com o back-end:', err)
        if (ativo) setMensagem('Erro ao conectar com o servidor. Confira se a API está rodando na porta 3000.')
      })
    return () => { ativo = false }
  }, [])

  return (
    <main className="container">
      <section className="hero">
        <span className="eyebrow">Aula 05 · Introdução ao React</span>
        <Saudacao />
        <p>Uma interface React com estado, efeito, lista dinâmica e conexão com a API Node.</p>
      </section>

      <section className="painel">
        <h2>Contador interativo</h2>
        <p>O useState mantém o valor entre as renderizações.</p>
        <button onClick={() => setN((valorAtual) => valorAtual + 1)}>
          Cliquei {n} {n === 1 ? 'vez' : 'vezes'}
        </button>
      </section>

      <section className="painel">
        <h2>Status do servidor</h2>
        <p className={mensagem.startsWith('Erro') ? 'status erro' : 'status'}>{mensagem}</p>
        <small>Endpoint consultado: GET {API_BASE}/api/health</small>
      </section>

      <section className="painel">
        <h2>Minhas tarefas</h2>
        <p>Lista de exemplo renderizada com o método map().</p>
        <ul className="lista">
          {tarefas.map((tarefa) => <li key={tarefa.id} className="tarefa" >{tarefa.titulo}</li>)}
        </ul>
        <small>Na próxima etapa, esta lista estática poderá ser substituída pelos dados reais de GET /api/tasks.</small>
      </section>
    </main>
  )
}
