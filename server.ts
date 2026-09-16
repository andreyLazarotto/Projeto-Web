import express from "express";
import Database from "better-sqlite3";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// 1. Criamos um "molde" (Interface) para nossas tarefas
interface Tarefa {
id: number;
titulo: string;
status: string;
prioridade: string;
}

// 2. Centralizamos as regras. Se a regra mudar, mudamos em um só lugar!
const PRIORIDADES = ["low", "medium", "high"] as const;
const STATUS_VALIDOS = ["pending", "completed"] as const;

// 3. Funções ajudantes (Helpers). Escrevemos a validação uma vez e usamos em todo lugar.
const tituloValido = (t: unknown): t is string =>
typeof t === "string" && t.trim().length >= 3;
const normalizarPrioridade = (p: unknown) => {
const listaPrioridades = PRIORIDADES as readonly string[];
return typeof p === "string" && listaPrioridades.includes(p)
? p
: "medium";
};
const normalizarStatus = (s: unknown) => {
const listaStatus = STATUS_VALIDOS as readonly string[];
return typeof s === "string" && listaStatus.includes(s)
? s
: "pending";
};
// 4. Um ajudante só para transformar e validar IDs
const parsearId = (idParam: string): number | null => {
const id = Number(idParam);
// Number("12abc") vira NaN imediatamente, o que é mais seguro!
return isNaN(id) ? null : id;
};

app.use(express.json());

const db = new Database("tarefas.db");

// Escrevemos (compilamos) as buscas UMA ÚNICA VEZ e guardamos na memória.
const stmtContarUsuarios = db.prepare("SELECT COUNT(*) as count FROM usuarios");
const stmtInserirUsuario = db.prepare("INSERT INTO usuarios (email, senha) VALUES (?, ?)");
const stmtListarTodas = db.prepare("SELECT * FROM tarefas");
const stmtBuscarPorTitulo = db.prepare("SELECT * FROM tarefas WHERE titulo LIKE ?");
const stmtBuscarPorId = db.prepare("SELECT * FROM tarefas WHERE id = ?");
const stmtInserirTarefa = db.prepare("INSERT INTO tarefas (titulo, status, prioridade) VALUES (?, 'pending', ?)");
const stmtDeletarTarefa = db.prepare("DELETE FROM tarefas WHERE id = ?");

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

// Bom: Tipagem correta sem usar "as any"
const usuariosExistentes = stmtContarUsuarios.get() as { count: number };
if (usuariosExistentes.count === 0) {
// Bom: Usamos a busca já preparada e passamos os dados de forma parametrizada
stmtInserirUsuario.run("admin@senai.com", "senha_super_secreta_123");
}

console.log("Banco de dados SQLite inicializado com sucesso!");

app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Servidor do Gestor de Tarefas ativo!"});
});

app.get("/api/version", (req, res) => {
    res.json({ appName: "Gerenciador de Tarefas Multi-Usuário", version: "1.0.0" });
});

app.get("/api/tasks", (req, res) => {
// 1. Coerção Segura: Forçamos a variável a ser uma String vazia caso tentem nos enviar
//um Array
const search = typeof req.query.search === "string" ? req.query.search : "";
try {
if (search) {
// 2. Proteção: O '%' entra DEPOIS, apenas dentro do parâmetro
const tarefas = stmtBuscarPorTitulo.all(`%${search}%`);
res.json(tarefas);
} else {
// 3. Performance: Usamos a busca compilada lá do Passo 2
const tarefas = stmtListarTodas.all();
res.json(tarefas);
}
} catch {
// 4. Erro Controlado: Se algo quebrar, damos uma mensagem genérica para não vazar
//a estrutura do banco
res.status(500).json({ error: "Erro interno ao processar a listagem." });
}
});


app.post("/api/tasks", (req, res) => {
const { titulo, prioridade } = req.body;
const prioridadeValida = normalizarPrioridade(prioridade);
// Validação via helper (type guard)
if (!tituloValido(titulo)) {
return res.status(400).json({
error: "O título da tarefa é obrigatório e deve conter pelo menos 3 caracteres válidos."
});
}
try {
const resultado = stmtInserirTarefa.run(titulo.trim(),
prioridadeValida);
const novaTarefa =
stmtBuscarPorId.get(resultado.lastInsertRowid) as Tarefa;
return res.status(201).json(novaTarefa);
} catch {
return res.status(500).json({ error: "Erro ao processar persistência" });
}
});

app.delete("/api/tasks/:id", (req, res) => {
// Validação de ID padronizada (igual PUT/PATCH)
const idParaDeletar = parsearId(req.params.id);
if (idParaDeletar === null) {
return res.status(400).json({ error: "ID inválido." });
}
try {
const resultado = stmtDeletarTarefa.run(idParaDeletar);
if (resultado.changes === 0) {
return res.status(404).json({ error: "Tarefa não localizada para exclusão." });
}
res.json({ message: "Tarefa excluída do banco SQLite com sucesso!" });
} catch {
res.status(500).json({ error: "Erro interno ao processar a exclusão." });
}
});

app.put("/api/tasks/:id", (req, res) => {
const idParaAtualizar = parsearId(req.params.id);
if (idParaAtualizar === null) {
return res.status(400).json({ error: "ID inválido." });
}
const { titulo, prioridade, status } = req.body;
// Validação via helpers
if (!tituloValido(titulo)) {
return res.status(400).json({
error: "O título da tarefa é obrigatório e deve conter pelo menos 3 caracteres válidos."
});
}
const prioridadeValida = normalizarPrioridade(prioridade);
const statusValido = normalizarStatus(status);
try {
// Prepared statement inline (UPDATE completo não tem statement fixo no topo)
const sql = "UPDATE tarefas SET titulo = ?, status = ?, prioridade = ? WHERE id = ?";
const resultado = db.prepare(sql).run(titulo.trim(),
statusValido, prioridadeValida, idParaAtualizar);
if (resultado.changes === 0) {
return res.status(404).json({ message: "Tarefa não encontrada para atualização!" });
}
const tarefaAtualizada =
stmtBuscarPorId.get(idParaAtualizar) as Tarefa;
return res.status(200).json(tarefaAtualizada);
} catch {
return res.status(500).json({ error: "Erro ao processar a atualização no banco de dados." });
}
});


app.patch("/api/tasks/:id", (req, res) => {
const idParaAtualizar = parsearId(req.params.id);
if (idParaAtualizar === null) {
return res.status(400).json({ error: "ID inválido." });
}
if (!req.body || Object.keys(req.body).length === 0) {
return res.status(400).json({ error: "Nenhum campo fornecido para atualização." });
}
const { titulo, prioridade, status } = req.body;
try {
const fluxoAtualizacao = db.transaction(() => {
// Busca com statement singleton
const tarefaExistente =
stmtBuscarPorId.get(idParaAtualizar) as Tarefa | undefined;
if (!tarefaExistente) return null;
const camposParaAtualizar: string[] = [];
const valoresParaAtualizar: unknown[] = [];
// Título (se enviado)
if (titulo !== undefined) {
if (!tituloValido(titulo)) {
throw new Error("O título da tarefa deve conter pelo menos 3 caracteres válidos.");
}
camposParaAtualizar.push("titulo = ?");
valoresParaAtualizar.push(titulo.trim());
}
// Prioridade (se enviada)
if (prioridade !== undefined) {
if (!PRIORIDADES.includes(prioridade as typeof
PRIORIDADES[number])) {
throw new Error("Prioridade inválida. Use 'low', 'medium' ou 'high'.");
}
camposParaAtualizar.push("prioridade = ?");
valoresParaAtualizar.push(prioridade);
}
// Status (se enviado)
if (status !== undefined) {
if (!STATUS_VALIDOS.includes(status as typeof
STATUS_VALIDOS[number])) {
throw new Error("Status inválido. Use 'pending' ou 'completed'.");
}
camposParaAtualizar.push("status = ?");
valoresParaAtualizar.push(status);
}
if (camposParaAtualizar.length === 0) return
tarefaExistente;
// Query dinâmica SEGURA: placeholders ? + valores array
const sql = `UPDATE tarefas SET $
{camposParaAtualizar.join(", ")} WHERE id = ?`;
valoresParaAtualizar.push(idParaAtualizar);
db.prepare(sql).run(...valoresParaAtualizar);
return stmtBuscarPorId.get(idParaAtualizar) as Tarefa;
});
const resultado = fluxoAtualizacao();
if (!resultado) {
return res.status(404).json({ message: "Tarefa não encontrada para atualização parcial!" });
}
return res.status(200).json(resultado);
} catch (erro) {
// Distingue erro de validação (400) de erro interno (500)
if (erro instanceof Error &&
(erro.message.includes("inválid") ||
erro.message.includes("caracteres"))) {
return res.status(400).json({ error: erro.message });
}
return res.status(500).json({ error: "Erro ao processar a atualização parcial no banco." });
}
});


app.listen(PORT, () => {
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
});