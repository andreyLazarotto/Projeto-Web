import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'

interface Tarefa {
  id: number
  titulo: string
  status: 'pending' | 'completed'
  prioridade: 'low' | 'medium' | 'high'
  usuario_id: number
}

interface Usuario {
  id: number
  email: string
  senha: string
}

declare global {
  namespace Express {
    interface Request {
      usuarioId?: number
    }
  }
}

const app = express()
const PORT = Number(process.env.PORT) || 3000
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreto_desenvolvimento'
const PRIORIDADES = ['low', 'medium', 'high'] as const
const STATUS_VALIDOS = ['pending', 'completed'] as const

const db = new Database('tarefas.db')
db.pragma('foreign_keys = ON')
app.use(cors())
app.use(express.json())

const tituloValido = (valor: unknown): valor is string =>
  typeof valor === 'string' && valor.trim().length >= 3

const parsearId = (valor: string): number | null => {
  const id = Number(valor)
  return Number.isInteger(id) && id > 0 ? id : null
}

// Cria o esquema atual e adapta uma base antiga da Aula 05, se necessário.
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tarefas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    prioridade TEXT NOT NULL DEFAULT 'medium',
    usuario_id INTEGER REFERENCES usuarios(id)
  );
`)

const colunasTarefas = db.prepare('PRAGMA table_info(tarefas)').all() as Array<{ name: string }>
if (!colunasTarefas.some((coluna) => coluna.name === 'usuario_id')) {
  db.exec('ALTER TABLE tarefas ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)')
}

// Conta administrativa de demonstração usada nos materiais da disciplina.
const adminEmail = 'admin@senai.com'
const adminSenha = 'senha_super_secreta_123'
const buscarAdmin = db.prepare('SELECT id, email, senha FROM usuarios WHERE email = ?')
const adminExistente = buscarAdmin.get(adminEmail) as Usuario | undefined
if (!adminExistente) {
  db.prepare('INSERT INTO usuarios (email, senha) VALUES (?, ?)').run(
    adminEmail,
    bcrypt.hashSync(adminSenha, 10),
  )
} else if (!bcrypt.compareSync(adminSenha, adminExistente.senha)) {
  // Corrige contas antigas que possam ter sido gravadas em texto puro.
  db.prepare('UPDATE usuarios SET senha = ? WHERE id = ?').run(
    bcrypt.hashSync(adminSenha, 10),
    adminExistente.id,
  )
}

const autenticar = (req: Request, res: Response, next: NextFunction): void => {
  const autorizacao = req.headers.authorization
  const token = autorizacao?.startsWith('Bearer ') ? autorizacao.slice(7) : ''

  if (!token) {
    res.status(401).json({ error: 'Autenticação necessária.' })
    return
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload
    if (typeof payload.id !== 'number') {
      res.status(401).json({ error: 'Token inválido.' })
      return
    }
    req.usuarioId = payload.id
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' })
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Servidor do Gestor de Tarefas ativo!' })
})

app.get('/api/version', (_req, res) => {
  res.json({ appName: 'Gerenciador de Tarefas Multi-Usuário', version: '1.0.0' })
})

app.post('/api/auth/register', (req, res) => {
  const corpo = req.body ?? {}
  const email = corpo.email
  const senha = corpo.senha

  if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim()) {
    res.status(400).json({ error: 'E-mail e senha são obrigatórios.' })
    return
  }
  if (!email.includes('@')) {
    res.status(400).json({ error: 'Informe um e-mail válido.' })
    return
  }
  if (senha.trim().length < 6) {
    res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' })
    return
  }

  try {
    const resultado = db.prepare('INSERT INTO usuarios (email, senha) VALUES (?, ?)').run(
      email.trim(),
      bcrypt.hashSync(senha, 10),
    )
    res.status(201).json({ id: Number(resultado.lastInsertRowid), email: email.trim() })
  } catch {
    res.status(409).json({ error: 'E-mail já cadastrado.' })
  }
})

app.post('/api/auth/login', (req, res) => {
  const corpo = req.body ?? {}
  const email = corpo.email
  const senha = corpo.senha

  if (typeof email !== 'string' || typeof senha !== 'string') {
    res.status(400).json({ error: 'E-mail e senha são obrigatórios.' })
    return
  }

  const usuario = db.prepare('SELECT id, email, senha FROM usuarios WHERE email = ?')
    .get(email.trim()) as Usuario | undefined
  const hashFalso = '$2a$10$fakehashparanaquebrarcomparacao'
  const senhaCorreta = bcrypt.compareSync(senha, usuario?.senha ?? hashFalso)

  if (!usuario || !senhaCorreta) {
    res.status(401).json({ error: 'Credenciais inválidas.' })
    return
  }

  const token = jwt.sign({ id: usuario.id, email: usuario.email }, JWT_SECRET, {
    expiresIn: '2h',
  })
  res.json({ token })
})

// Todas as rotas de tarefas exigem JWT e filtram pelo dono da tarefa.
app.get('/api/tasks', autenticar, (req, res) => {
  const busca = typeof req.query.search === 'string' ? req.query.search : ''
  const usuarioId = req.usuarioId!
  const tarefas = busca
    ? db.prepare('SELECT id, titulo, status, prioridade FROM tarefas WHERE usuario_id = ? AND titulo LIKE ? ORDER BY id DESC')
        .all(usuarioId, `%${busca}%`)
    : db.prepare('SELECT id, titulo, status, prioridade FROM tarefas WHERE usuario_id = ? ORDER BY id DESC')
        .all(usuarioId)
  res.json(tarefas)
})

app.post('/api/tasks', autenticar, (req, res) => {
  const corpo = req.body ?? {}
  const titulo = corpo.titulo
  const prioridade = corpo.prioridade
  if (!tituloValido(titulo)) {
    res.status(400).json({ error: 'O título da tarefa é obrigatório e deve conter pelo menos 3 caracteres válidos.' })
    return
  }
  const prioridadeValida = typeof prioridade === 'string' &&
    PRIORIDADES.includes(prioridade as (typeof PRIORIDADES)[number])
    ? prioridade
    : 'medium'

  const resultado = db.prepare(
    "INSERT INTO tarefas (titulo, status, prioridade, usuario_id) VALUES (?, 'pending', ?, ?)",
  ).run(titulo.trim(), prioridadeValida, req.usuarioId!)
  const tarefa = db.prepare(
    'SELECT id, titulo, status, prioridade FROM tarefas WHERE id = ?',
  ).get(Number(resultado.lastInsertRowid)) as Tarefa
  res.status(201).json(tarefa)
})

app.put('/api/tasks/:id', autenticar, (req, res) => {
  const id = parsearId(String(req.params.id))
  if (id === null) {
    res.status(400).json({ error: 'ID inválido.' })
    return
  }
  const corpo = req.body ?? {}
  const { titulo, prioridade, status } = corpo
  if (!tituloValido(titulo)) {
    res.status(400).json({ error: 'O título da tarefa deve conter pelo menos 3 caracteres válidos.' })
    return
  }
  if (typeof prioridade !== 'string' || !PRIORIDADES.includes(prioridade as (typeof PRIORIDADES)[number])) {
    res.status(400).json({ error: 'Prioridade inválida. Use low, medium ou high.' })
    return
  }
  if (typeof status !== 'string' || !STATUS_VALIDOS.includes(status as (typeof STATUS_VALIDOS)[number])) {
    res.status(400).json({ error: 'Status inválido. Use pending ou completed.' })
    return
  }

  const resultado = db.prepare(
    'UPDATE tarefas SET titulo = ?, prioridade = ?, status = ? WHERE id = ? AND usuario_id = ?',
  ).run(titulo.trim(), prioridade, status, id, req.usuarioId!)
  if (resultado.changes === 0) {
    res.status(404).json({ error: 'Tarefa não encontrada.' })
    return
  }
  const tarefa = db.prepare(
    'SELECT id, titulo, status, prioridade FROM tarefas WHERE id = ? AND usuario_id = ?',
  ).get(id, req.usuarioId!)
  res.json(tarefa)
})

app.patch('/api/tasks/:id', autenticar, (req, res) => {
  const id = parsearId(String(req.params.id))
  if (id === null) {
    res.status(400).json({ error: 'ID inválido.' })
    return
  }
  const corpo = req.body ?? {}
  const campos: string[] = []
  const valores: Array<string | number> = []

  if (corpo.titulo !== undefined) {
    if (!tituloValido(corpo.titulo)) {
      res.status(400).json({ error: 'O título deve conter pelo menos 3 caracteres válidos.' })
      return
    }
    campos.push('titulo = ?')
    valores.push(corpo.titulo.trim())
  }
  if (corpo.prioridade !== undefined) {
    if (typeof corpo.prioridade !== 'string' ||
      !PRIORIDADES.includes(corpo.prioridade as (typeof PRIORIDADES)[number])) {
      res.status(400).json({ error: 'Prioridade inválida.' })
      return
    }
    campos.push('prioridade = ?')
    valores.push(corpo.prioridade)
  }
  if (corpo.status !== undefined) {
    if (typeof corpo.status !== 'string' ||
      !STATUS_VALIDOS.includes(corpo.status as (typeof STATUS_VALIDOS)[number])) {
      res.status(400).json({ error: 'Status inválido.' })
      return
    }
    campos.push('status = ?')
    valores.push(corpo.status)
  }
  if (campos.length === 0) {
    res.status(400).json({ error: 'Nenhum campo válido foi fornecido.' })
    return
  }

  valores.push(id, req.usuarioId!)
  const resultado = db.prepare(
    `UPDATE tarefas SET ${campos.join(', ')} WHERE id = ? AND usuario_id = ?`,
  ).run(...valores)
  if (resultado.changes === 0) {
    res.status(404).json({ error: 'Tarefa não encontrada.' })
    return
  }
  const tarefa = db.prepare(
    'SELECT id, titulo, status, prioridade FROM tarefas WHERE id = ? AND usuario_id = ?',
  ).get(id, req.usuarioId!)
  res.json(tarefa)
})

app.delete('/api/tasks/:id', autenticar, (req, res) => {
  const id = parsearId(String(req.params.id))
  if (id === null) {
    res.status(400).json({ error: 'ID inválido.' })
    return
  }
  const resultado = db.prepare(
    'DELETE FROM tarefas WHERE id = ? AND usuario_id = ?',
  ).run(id, req.usuarioId!)
  if (resultado.changes === 0) {
    res.status(404).json({ error: 'Tarefa não encontrada.' })
    return
  }
  res.json({ message: 'Tarefa excluída com sucesso.' })
})

app.listen(PORT, () => {
  console.log(`Servidor rodando em: http://localhost:${PORT}`)
})
