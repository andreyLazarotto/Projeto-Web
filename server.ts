import express from "express";
import Database from "better-sqlite3";

const app = express();
const PORT = 3000;

app.use(express.json());

const db = new Database("tarefas.db");

db.exec(`
    CREATE TABLE IF NOT EXISTS tarefas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        prioridade TEXT DEFAULT 'medium'
    );

    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        senha TEXT NOT NULL
    );
`);

const usuariosExistentes = db.prepare("SELECT COUNT(*) AS count FROM usuarios").get() as any;
if (usuariosExistentes.count === 0) {
    db.exec(`
        INSERT INTO usuarios (email, senha) VALUES ('admin@senail.com', 'senha_super_segura_123')
    `);
}

console.log("Banco de dados SQLite inicializado com sucesso!");

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Servidor do Gestor de Tarefas ativo!"});
});

app.get("/api/version", (req, res) => {
    res.json({ appName: "Gerenciador de Tarefas Multi-Usuário", version: "1.0.0" });
});

app.get("/api/tasks", (req, res) => {
    const { search } = req.query;
    try {
        if (search) {
            const sql = "SELECT * FROM tarefas WHERE titulo LIKE ?";
            const tarefas = db.prepare(sql).all(`%${search}%`);
            res.json(tarefas);
        } else {
            const tarefas = db.prepare("SELECT * FROM tarefas").all();
            res.json(tarefas);
        }
    } catch (erro) {
        res.status(500).json({ error: erro instanceof Error ? erro.message : "Erro desconhecido" });
    }
});

app.post("/api/tasks", (req, res) => {
    const { title, prioridade } = req.body;
    const prioridadeValida = ['low', 'medium', 'high'].includes(prioridade) ? prioridade : 'medium';
    
    if (!title || title.trim().length < 3) {
        return res.status(400).json({ 
            error: "O título da tarefa é obrigatório e deve conter pelo menos 3 caracteres válidos." 
        });
    }

    try {
        const sql = "INSERT INTO tarefas (titulo, status, prioridade) VALUES (?, 'pending', ?)";
        const resultado = db.prepare(sql).run(title.trim(), prioridadeValida);
        const novaTarefa = db.prepare("SELECT * FROM tarefas WHERE id = ?").get(resultado.lastInsertRowid);
        return res.status(201).json(novaTarefa);
    } catch (erro) {
        return res.status(500).json({ error: "Erro ao processar persistência" });
    }
});

app.delete("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    try {
        const sql = "DELETE FROM tarefas WHERE id = ?";
        const resultado = db.prepare(sql).run(id);
        if (resultado.changes === 0) {
            res.status(404).json({ error: "Tarefa não localizada para exclusão." });
            return;
        }
        res.json({ message: "Tarefa excluída do banco SQLite com sucesso!" });
    } catch (erro) { 
        res.status(500).json({ error: erro instanceof Error ? erro.message : "Erro desconhecido" });
    }
});

app.put("/api/tasks/:id", (req, res) => {
  const idParaAtualizar = parseInt(req.params.id);
  if (isNaN(idParaAtualizar)) {
    return res.status(400).json({ error: "ID inválido." });
  }

  const { title, prioridade, status } = req.body;

  if (!title || title.trim().length < 3) {
    return res.status(400).json({
      error: "O título da tarefa é obrigatório e deve conter pelo menos 3 caracteres válidos."
    });
  }

  const prioridadeValida = ['low', 'medium', 'high'].includes(prioridade) ? prioridade : 'medium';
  const statusValido = ['pending', 'completed'].includes(status) ? status : 'pending';

  try {
    const sql = "UPDATE tarefas SET titulo = ?, status = ?, prioridade = ? WHERE id = ?";
    const resultado = db.prepare(sql).run(title.trim(), statusValido, prioridadeValida, idParaAtualizar);

    if (resultado.changes === 0) {
      return res.status(404).json({ message: "Tarefa não encontrada para atualização!" });
    }

    const tarefaAtualizada = db.prepare("SELECT * FROM tarefas WHERE id = ?").get(idParaAtualizar);
    return res.status(200).json(tarefaAtualizada);

  } catch (erro) {
    return res.status(500).json({ error: "Erro ao processar a atualização no banco de dados." });
  }
});

app.patch("/api/tasks/:id", (req, res) => {
  const idParaAtualizar = parseInt(req.params.id);
  if (isNaN(idParaAtualizar)) {
    return res.status(400).json({ error: "ID inválido." });
  }

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: "Nenhum campo fornecido para atualização." });
  }

  const { title, prioridade, status } = req.body;

  try {
    const fluxoAtualizacao = db.transaction(() => {
      const tarefaExistente = db.prepare("SELECT * FROM tarefas WHERE id = ?").get(idParaAtualizar) as any;
      if (!tarefaExistente) return null;

      const camposParaAtualizar: string[] = [];
      const valoresParaAtualizar: any[] = [];

      if (title !== undefined) {
        if (typeof title !== "string" || title.trim().length < 3) {
          throw new Error("O título da tarefa deve conter pelo menos 3 caracteres válidos.");
        }
        camposParaAtualizar.push("titulo = ?");
        valoresParaAtualizar.push(title.trim());
      }

      if (prioridade !== undefined) {
        if (!['low', 'medium', 'high'].includes(prioridade)) {
          throw new Error("Prioridade inválida. Use 'low', 'medium' ou 'high'.");
        }
        camposParaAtualizar.push("prioridade = ?");
        valoresParaAtualizar.push(prioridade);
      }

      if (status !== undefined) {
        if (!['pending', 'completed'].includes(status)) {
          throw new Error("Status inválido. Use 'pending' ou 'completed'.");
        }
        camposParaAtualizar.push("status = ?");
        valoresParaAtualizar.push(status);
      }

      if (camposParaAtualizar.length === 0) return tarefaExistente;

      const sql = `UPDATE tarefas SET ${camposParaAtualizar.join(", ")} WHERE id = ?`;
      valoresParaAtualizar.push(idParaAtualizar);

      db.prepare(sql).run(...valoresParaAtualizar);
      return db.prepare("SELECT * FROM tarefas WHERE id = ?").get(idParaAtualizar);
    });

    const resultado = fluxoAtualizacao();

    if (!resultado) {
      return res.status(404).json({ message: "Tarefa não encontrada para atualização parcial!" });
    }

    return res.status(200).json(resultado);

  } catch (erro) {
    if (erro instanceof Error && 
       (erro.message.includes("inválid") || erro.message.includes("caracteres"))) {
      return res.status(400).json({ error: erro.message });
    }
    return res.status(500).json({ error: "Erro ao processar a atualização parcial no banco." });
  }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
});