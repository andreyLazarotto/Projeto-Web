/**
 * Única camada do front-end responsável por conversar com a API.
 * O token serve para autenticar as requisições; o servidor é quem valida
 * a assinatura e decide se o acesso é permitido.
 */
const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : ''
const TOKEN_KEY = 'gestor:token'

export interface AuthResult {
  token: string
}

export interface RegistroResult {
  id: number
  email: string
}

export interface Usuario {
  id: number
  email: string
}

export interface Tarefa {
  id: number
  titulo: string
  status: 'pending' | 'completed'
  prioridade: 'low' | 'medium' | 'high'
}

export const setToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token)
}

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)

export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY)
}

export const authHeaders = (): Record<string, string> => {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const tratarResposta = async <T,>(res: Response): Promise<T> => {
  const texto = await res.text()
  let dados: unknown

  try {
    dados = texto ? JSON.parse(texto) : null
  } catch {
    dados = null
  }

  if (!res.ok) {
    const mensagem =
      (dados as { error?: string } | null)?.error ??
      `Falha na requisição (HTTP ${res.status}).`
    throw new Error(mensagem)
  }

  return dados as T
}

/** Decodifica o payload apenas para exibir o e-mail; não valida autorização. */
export const getUsuario = (): Usuario | null => {
  const token = getToken()
  if (!token) return null

  const partes = token.split('.')
  if (partes.length !== 3) {
    clearToken()
    return null
  }

  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/')
    const binario = atob(base64)
    const percentEncoded = binario
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
    const payload: unknown = JSON.parse(decodeURIComponent(percentEncoded))
    const dados = payload as { id?: number; email?: string; exp?: number }

    if (typeof dados?.id !== 'number' || typeof dados?.email !== 'string') {
      clearToken()
      return null
    }
    if (typeof dados.exp === 'number' && dados.exp * 1000 < Date.now()) {
      clearToken()
      return null
    }
    return { id: dados.id, email: dados.email }
  } catch {
    clearToken()
    return null
  }
}

export const login = async (email: string, senha: string): Promise<AuthResult> => {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  })
  const dados = await tratarResposta<AuthResult>(res)
  setToken(dados.token)
  return dados
}

export const registrar = async (
  email: string,
  senha: string,
): Promise<RegistroResult> => {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  })
  return await tratarResposta<RegistroResult>(res)
}

/** Métodos de tarefas já preparados para a próxima aula. */
export const listarTarefas = async (search = ''): Promise<Tarefa[]> => {
  const url = `${API_BASE}/api/tasks${search ? `?search=${encodeURIComponent(search)}` : ''}`
  const res = await fetch(url, { headers: authHeaders() })
  return await tratarResposta<Tarefa[]>(res)
}

export const criarTarefa = async (
  titulo: string,
  prioridade: Tarefa['prioridade'],
): Promise<Tarefa> => {
  const res = await fetch(`${API_BASE}/api/tasks`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ titulo, prioridade }),
  })
  return await tratarResposta<Tarefa>(res)
}

export const atualizarTarefa = async (
  id: number,
  dados: Partial<Pick<Tarefa, 'titulo' | 'status' | 'prioridade'>>,
): Promise<Tarefa> => {
  const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(dados),
  })
  return await tratarResposta<Tarefa>(res)
}

export const deletarTarefa = async (id: number): Promise<{ message: string }> => {
  const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return await tratarResposta<{ message: string }>(res)
}
