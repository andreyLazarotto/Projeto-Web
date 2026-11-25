import { useState } from 'react'
import Login from './Login'
import Tarefas from './Tarefas'
import { clearToken, getUsuario, type Usuario } from './api'

export default function App() {
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

  return <Tarefas usuario={usuario} aoSair={aoSair} />
}
