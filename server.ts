import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Usuario {
  id: number;
  email: string;
  senha_hash: string;
  criado_em?: string;
}

interface Tarefa {
  id: number;
  titulo: string;
  descricao: string | null;
  status: "pending" | "completed";
  prioridade: "low" | "medium" | "high";
  usuario_id: number;
  criado_em?: string;
  atualizado_em?: string;
}

declare global {
  namespace Express {
    interface Request {
      usuarioId?: number;
    }
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARQUIVO_ENV = path.join(__dirname, ".env");
const FRONT_DIST = path.join(__dirname, "web", "dist");
const FRONT_INDEX = path.join(FRONT_DIST, "index.html");

const SEM_BUILD = [
  "Ainda não existe o build do front-end.",
  "",
  "Procurei este arquivo:",
  `  ${FRONT_INDEX}`,
  "",
  "Gere-o com:",
  "  npm run build:web",
  "",
  "Enquanto isso, a API continua funcionando em /api/health.",
].join("\n");

function carregarEnv(): void {
  if (!fs.existsSync(ARQUIVO_ENV)) return;

  const bruto = fs.readFileSync(ARQUIVO_ENV);
  if (
    bruto.length >= 3 &&
    bruto[0] === 0xef &&
    bruto[1] === 0xbb &&
    bruto[2] === 0xbf
  ) {
    console.warn(
      "\n[ATENÇÃO] O arquivo .env foi salvo com BOM (0xEF 0xBB 0xBF).\n" +
        "          Salve novamente como UTF-8 sem BOM e confira a TURSO_URL.\n",
    );
  }

  // Variáveis já definidas no ambiente do sistema têm prioridade.
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(ARQUIVO_ENV);
    return;
  }

  // Compatibilidade com versões do Node que ainda não possuem loadEnvFile.
  const conteudo = bruto.toString("utf8").replace(/^\uFEFF/, "");
  for (const linha of conteudo.split(/\r?\n/)) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;

    const separador = limpa.indexOf("=");
    if (separador < 1) continue;

    const chave = limpa.slice(0, separador).trim();
    let valor = limpa.slice(separador + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (process.env[chave] === undefined) process.env[chave] = valor;
  }
}

carregarEnv();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET =
  process.env.JWT_SECRET || "super_secreto_desenvolvimento";

const TURSO_URL = process.env.TURSO_URL?.trim();
const TURSO_TOKEN = process.env.TURSO_TOKEN?.trim();
const usandoNuvem = Boolean(TURSO_URL && TURSO_TOKEN);
const MODO_BANCO = usandoNuvem
  ? "Turso / libSQL (nuvem)"
  : "arquivo local (SQLite)";

const db = createClient({
  url: usandoNuvem ? TURSO_URL! : "file:./tarefas.db",
  authToken: usandoNuvem ? TURSO_TOKEN : undefined,
});

let possuiColunaSenhaLegada = false;

const PRIORIDADES = ["low", "medium", "high"] as const;
const STATUS_VALIDOS = ["pending", "completed"] as const;

app.use(cors());
app.use(express.json());

function exibirBannerBanco(): void {
  console.log("============================================================");
  console.log("  Banco de dados");
  console.log("------------------------------------------------------------");
  console.log(`  Modo  : ${MODO_BANCO}`);
  console.log(
    `  Onde  : ${usandoNuvem ? TURSO_URL : path.resolve("tarefas.db")}`,
  );
  console.log(
    `  Token : ${usandoNuvem ? "presente (nunca será mostrado)" : "não informado"}`,
  );
  if (!usandoNuvem) {
    console.log("  Para usar o Turso, crie um arquivo .env na raiz com:");
    console.log("    TURSO_URL=libsql://seu-banco.turso.io");
    console.log("    TURSO_TOKEN=seu-token");
  }
  console.log("============================================================");
}

function maisRecente(dir: string): number {
  let maior = 0;
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      maior = Math.max(maior, maisRecente(caminho));
    } else {
      maior = Math.max(maior, fs.statSync(caminho).mtimeMs);
    }
  }
  return maior;
}

const tituloValido = (valor: unknown): valor is string =>
  typeof valor === "string" && valor.trim().length >= 3;

const parsearId = (valor: string): number | null => {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
};

function primeiraLinha<T>(rows: unknown[]): T | undefined {
  return rows[0] as T | undefined;
}

function erroDeEmailDuplicado(erro: unknown): boolean {
  const mensagem =
    erro instanceof Error ? erro.message : String(erro);
  return (
    mensagem.includes("UNIQUE constraint failed") ||
    mensagem.includes("SQLITE_CONSTRAINT_UNIQUE")
  );
}

async function adicionarColunaSeNaoExistir(
  tabela: string,
  coluna: string,
  definicao: string,
): Promise<void> {
  const resultado = await db.execute(`PRAGMA table_info(${tabela})`);
  const existe = resultado.rows.some(
    (linha) => String(linha.name) === coluna,
  );
  if (!existe) {
    await db.execute(
      `ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`,
    );
    console.log(`  Coluna ${tabela}.${coluna} adicionada.`);
  }
}

const SQL_USUARIOS = `
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

const SQL_TAREFAS = `
  CREATE TABLE IF NOT EXISTS tarefas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    prioridade TEXT NOT NULL DEFAULT 'medium',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
  )
`;

async function inserirUsuario(email: string, senhaHash: string) {
  if (possuiColunaSenhaLegada) {
    // Bancos antigos tinham a coluna senha como NOT NULL.
    return db.execute({
      sql: "INSERT INTO usuarios (email, senha_hash, senha) VALUES (?, ?, ?)",
      args: [email, senhaHash, senhaHash],
    });
  }
  return db.execute({
    sql: "INSERT INTO usuarios (email, senha_hash) VALUES (?, ?)",
    args: [email, senhaHash],
  });
}

async function inicializarBanco(): Promise<void> {
  try {
    // Cada comando é enviado separadamente pelo batch do libSQL.
    await db.batch([SQL_USUARIOS, SQL_TAREFAS], "write");
    await db.execute("PRAGMA foreign_keys = ON");

    // Compatibilidade com bancos criados nas aulas anteriores.
    await adicionarColunaSeNaoExistir(
      "usuarios",
      "senha_hash",
      "TEXT",
    );
    await adicionarColunaSeNaoExistir(
      "usuarios",
      "criado_em",
      "DATETIME",
    );
    await adicionarColunaSeNaoExistir("tarefas", "usuario_id", "INTEGER");
    await adicionarColunaSeNaoExistir("tarefas", "descricao", "TEXT");
    await adicionarColunaSeNaoExistir(
      "tarefas",
      "criado_em",
      "DATETIME",
    );
    await adicionarColunaSeNaoExistir(
      "tarefas",
      "atualizado_em",
      "DATETIME",
    );

    // SQLite não permite DEFAULT CURRENT_TIMESTAMP em ADD COLUMN.
    // Preenche os campos recém-adicionados sem alterar registros já preenchidos.
    await db.execute(
      "UPDATE usuarios SET criado_em = CURRENT_TIMESTAMP WHERE criado_em IS NULL",
    );
    await db.execute(
      "UPDATE tarefas SET criado_em = CURRENT_TIMESTAMP WHERE criado_em IS NULL",
    );
    await db.execute(
      "UPDATE tarefas SET atualizado_em = CURRENT_TIMESTAMP WHERE atualizado_em IS NULL",
    );

    // Migra a coluna senha antiga para senha_hash sem apagar os dados.
    const colunasUsuarios = await db.execute("PRAGMA table_info(usuarios)");
    possuiColunaSenhaLegada = colunasUsuarios.rows.some(
      (linha) => String((linha as Record<string, unknown>).name) === "senha",
    );
    if (possuiColunaSenhaLegada) {
      await db.execute(`
        UPDATE usuarios
        SET senha_hash = senha
        WHERE (senha_hash IS NULL OR senha_hash = '')
          AND senha IS NOT NULL
      `);
    }

    // Conta de demonstração usada nos materiais da disciplina.
    const adminEmail = "admin@senai.com";
    const adminSenha = "senha_super_secreta_123";
    const adminResultado = await db.execute({
      sql: "SELECT id, email, senha_hash FROM usuarios WHERE email = ?",
      args: [adminEmail],
    });
    let admin = primeiraLinha<Usuario>(adminResultado.rows);

    if (!admin) {
      const hash = await bcrypt.hash(adminSenha, 10);
      const insercao = await inserirUsuario(adminEmail, hash);
      admin = {
        id: Number(insercao.lastInsertRowid),
        email: adminEmail,
        senha_hash: hash,
      };
    } else if (!admin.senha_hash) {
      const hash = await bcrypt.hash(adminSenha, 10);
      await db.execute({
        sql: possuiColunaSenhaLegada
          ? "UPDATE usuarios SET senha_hash = ?, senha = ? WHERE id = ?"
          : "UPDATE usuarios SET senha_hash = ? WHERE id = ?",
        args: possuiColunaSenhaLegada
          ? [hash, hash, admin.id]
          : [hash, admin.id],
      });
      admin.senha_hash = hash;
    }

    // Tarefas antigas sem proprietário passam para a conta de demonstração.
    await db.execute({
      sql: "UPDATE tarefas SET usuario_id = ? WHERE usuario_id IS NULL",
      args: [admin.id],
    });

    console.log("  Estrutura do banco verificada e pronta.");
  } catch (erro: unknown) {
    const detalhe =
      erro instanceof Error ? erro.message : String(erro);
    console.error("\n[ERRO] Não consegui preparar o banco de dados.");
    console.error(`  Modo   : ${MODO_BANCO}`);
    console.error(
      `  Onde   : ${usandoNuvem ? TURSO_URL : path.resolve("tarefas.db")}`,
    );
    console.error(`  Detalhe: ${detalhe}`);
    if (usandoNuvem) {
      console.error(
        "  Confira se a TURSO_URL não termina com barra e se o TURSO_TOKEN está completo.\n",
      );
    }
    process.exit(1);
  }
}

const autenticar = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const autorizacao = req.headers.authorization;
  const token = autorizacao?.startsWith("Bearer ")
    ? autorizacao.slice(7)
    : "";

  if (!token) {
    res.status(401).json({ error: "Autenticação necessária." });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (typeof payload.id !== "number") {
      res.status(401).json({ error: "Token inválido." });
      return;
    }
    req.usuarioId = payload.id;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado." });
  }
};

app.get("/api/health", async (_req: Request, res: Response) => {
  try {
    await db.execute("SELECT 1");
    return res.json({
      status: "ok",
      message: "Servidor do Gestor de Tarefas ativo!",
      banco: MODO_BANCO,
    });
  } catch {
    return res.status(503).json({
      status: "erro",
      message: "O servidor está no ar, mas o banco de dados não respondeu.",
      banco: MODO_BANCO,
    });
  }
});

app.get("/api/version", (_req: Request, res: Response) => {
  res.json({
    appName: "Gerenciador de Tarefas Multi-Usuário",
    version: "1.0.0",
  });
});

app.post("/api/auth/register", async (req: Request, res: Response) => {
  const corpo = req.body ?? {};
  const email = corpo.email;
  const senha = corpo.senha;

  if (
    typeof email !== "string" ||
    typeof senha !== "string" ||
    !email.trim()
  ) {
    return res
      .status(400)
      .json({ error: "E-mail e senha são obrigatórios." });
  }
  if (!email.trim().includes("@")) {
    return res.status(400).json({ error: "Informe um e-mail válido." });
  }
  if (senha.length < 6) {
    return res
      .status(400)
      .json({ error: "A senha deve ter ao menos 6 caracteres." });
  }

  try {
    const emailNormalizado = email.trim().toLowerCase();
    const hash = await bcrypt.hash(senha, 10);
    const resultado = await inserirUsuario(emailNormalizado, hash);
    return res.status(201).json({
      message: "Usuário cadastrado com sucesso!",
      user: {
        id: Number(resultado.lastInsertRowid),
        email: emailNormalizado,
      },
    });
  } catch (erro: unknown) {
    if (erroDeEmailDuplicado(erro)) {
      return res.status(409).json({ error: "E-mail já cadastrado." });
    }
    console.error("[CADASTRO]", erro);
    return res
      .status(500)
      .json({ error: "Não foi possível cadastrar agora. Tente de novo." });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const corpo = req.body ?? {};
  const email = corpo.email;
  const senha = corpo.senha;

  if (typeof email !== "string" || typeof senha !== "string" || !email.trim()) {
    return res
      .status(400)
      .json({ error: "E-mail e senha são obrigatórios." });
  }

  let usuario: Usuario | undefined;
  try {
    const resultado = await db.execute({
      sql: "SELECT id, email, senha_hash FROM usuarios WHERE email = ?",
      args: [email.trim().toLowerCase()],
    });
    usuario = primeiraLinha<Usuario>(resultado.rows);
  } catch (erro) {
    console.error("[LOGIN/BANCO]", erro);
    return res
      .status(500)
      .json({ error: "Não foi possível entrar agora. Tente de novo." });
  }

  const hashFalso = "$2a$10$fakehashparanaquebrarcomparacao";
  const senhaCorreta = await bcrypt.compare(
    senha,
    usuario?.senha_hash || hashFalso,
  );

  if (!usuario || !usuario.senha_hash || !senhaCorreta) {
    return res.status(401).json({ error: "Credenciais inválidas." });
  }

  const token = jwt.sign(
    { id: usuario.id, email: usuario.email },
    JWT_SECRET,
    { expiresIn: "8h" },
  );
  return res.json({ token });
});

app.get("/api/tasks", autenticar, async (req: Request, res: Response) => {
  try {
    const busca =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    const resultado = busca
      ? await db.execute({
          sql: `SELECT id, titulo, status, prioridade
                FROM tarefas
                WHERE usuario_id = ? AND (titulo LIKE ? OR descricao LIKE ?)
                ORDER BY id DESC`,
          args: [req.usuarioId!, `%${busca}%`, `%${busca}%`],
        })
      : await db.execute({
          sql: `SELECT id, titulo, status, prioridade
                FROM tarefas WHERE usuario_id = ? ORDER BY id DESC`,
          args: [req.usuarioId!],
        });
    return res.json(resultado.rows);
  } catch (erro) {
    console.error("[LISTAR TAREFAS]", erro);
    return res.status(500).json({ error: "Não foi possível listar as tarefas." });
  }
});

app.post("/api/tasks", autenticar, async (req: Request, res: Response) => {
  const corpo = req.body ?? {};
  const titulo = corpo.titulo;
  const descricao =
    typeof corpo.descricao === "string" ? corpo.descricao.trim() : null;
  const prioridade = corpo.prioridade;

  if (!tituloValido(titulo)) {
    return res.status(400).json({
      error:
        "O título da tarefa é obrigatório e deve conter pelo menos 3 caracteres válidos.",
    });
  }

  const prioridadeValida =
    typeof prioridade === "string" &&
    PRIORIDADES.includes(prioridade as (typeof PRIORIDADES)[number])
      ? prioridade
      : "medium";

  try {
    const resultado = await db.execute({
      sql: `INSERT INTO tarefas
            (titulo, descricao, status, prioridade, usuario_id)
            VALUES (?, ?, 'pending', ?, ?)`,
      args: [titulo.trim(), descricao, prioridadeValida, req.usuarioId!],
    });
    const tarefa = await db.execute({
      sql: `SELECT id, titulo, status, prioridade
            FROM tarefas WHERE id = ? AND usuario_id = ?`,
      args: [Number(resultado.lastInsertRowid), req.usuarioId!],
    });
    return res.status(201).json(primeiraLinha<Tarefa>(tarefa.rows));
  } catch (erro) {
    console.error("[CRIAR TAREFA]", erro);
    return res.status(500).json({ error: "Não foi possível criar a tarefa." });
  }
});

app.put(
  "/api/tasks/:id",
  autenticar,
  async (req: Request, res: Response) => {
    const id = parsearId(String(req.params.id));
    if (id === null) return res.status(400).json({ error: "ID inválido." });

    const corpo = req.body ?? {};
    const { titulo, prioridade, status } = corpo;
    if (!tituloValido(titulo)) {
      return res.status(400).json({
        error: "O título da tarefa deve conter pelo menos 3 caracteres válidos.",
      });
    }
    if (
      typeof prioridade !== "string" ||
      !PRIORIDADES.includes(prioridade as (typeof PRIORIDADES)[number])
    ) {
      return res
        .status(400)
        .json({ error: "Prioridade inválida. Use low, medium ou high." });
    }
    if (
      typeof status !== "string" ||
      !STATUS_VALIDOS.includes(status as (typeof STATUS_VALIDOS)[number])
    ) {
      return res
        .status(400)
        .json({ error: "Status inválido. Use pending ou completed." });
    }

    try {
      const resultado = await db.execute({
        sql: `UPDATE tarefas
              SET titulo = ?, prioridade = ?, status = ?,
                  atualizado_em = CURRENT_TIMESTAMP
              WHERE id = ? AND usuario_id = ?`,
        args: [titulo.trim(), prioridade, status, id, req.usuarioId!],
      });
      if (resultado.rowsAffected === 0) {
        return res.status(404).json({ error: "Tarefa não encontrada." });
      }
      const tarefa = await db.execute({
        sql: `SELECT id, titulo, status, prioridade
              FROM tarefas WHERE id = ? AND usuario_id = ?`,
        args: [id, req.usuarioId!],
      });
      return res.json(primeiraLinha<Tarefa>(tarefa.rows));
    } catch (erro) {
      console.error("[ATUALIZAR TAREFA]", erro);
      return res
        .status(500)
        .json({ error: "Não foi possível atualizar a tarefa." });
    }
  },
);

app.patch(
  "/api/tasks/:id",
  autenticar,
  async (req: Request, res: Response) => {
    const id = parsearId(String(req.params.id));
    if (id === null) return res.status(400).json({ error: "ID inválido." });

    const corpo = req.body ?? {};
    const campos: string[] = [];
    const valores: Array<string | number> = [];

    if (corpo.titulo !== undefined) {
      if (!tituloValido(corpo.titulo)) {
        return res.status(400).json({
          error: "O título deve conter pelo menos 3 caracteres válidos.",
        });
      }
      campos.push("titulo = ?");
      valores.push(corpo.titulo.trim());
    }
    if (corpo.prioridade !== undefined) {
      if (
        typeof corpo.prioridade !== "string" ||
        !PRIORIDADES.includes(corpo.prioridade as (typeof PRIORIDADES)[number])
      ) {
        return res.status(400).json({ error: "Prioridade inválida." });
      }
      campos.push("prioridade = ?");
      valores.push(corpo.prioridade);
    }
    if (corpo.status !== undefined) {
      if (
        typeof corpo.status !== "string" ||
        !STATUS_VALIDOS.includes(corpo.status as (typeof STATUS_VALIDOS)[number])
      ) {
        return res.status(400).json({ error: "Status inválido." });
      }
      campos.push("status = ?");
      valores.push(corpo.status);
    }
    if (campos.length === 0) {
      return res
        .status(400)
        .json({ error: "Nenhum campo válido foi fornecido." });
    }

    campos.push("atualizado_em = CURRENT_TIMESTAMP");
    valores.push(id, req.usuarioId!);

    try {
      const resultado = await db.execute({
        sql: `UPDATE tarefas SET ${campos.join(", ")}
              WHERE id = ? AND usuario_id = ?`,
        args: valores,
      });
      if (resultado.rowsAffected === 0) {
        return res.status(404).json({ error: "Tarefa não encontrada." });
      }
      const tarefa = await db.execute({
        sql: `SELECT id, titulo, status, prioridade
              FROM tarefas WHERE id = ? AND usuario_id = ?`,
        args: [id, req.usuarioId!],
      });
      return res.json(primeiraLinha<Tarefa>(tarefa.rows));
    } catch (erro) {
      console.error("[ATUALIZAR TAREFA/PATCH]", erro);
      return res
        .status(500)
        .json({ error: "Não foi possível atualizar a tarefa." });
    }
  },
);

app.delete(
  "/api/tasks/:id",
  autenticar,
  async (req: Request, res: Response) => {
    const id = parsearId(String(req.params.id));
    if (id === null) return res.status(400).json({ error: "ID inválido." });

    try {
      const resultado = await db.execute({
        sql: "DELETE FROM tarefas WHERE id = ? AND usuario_id = ?",
        args: [id, req.usuarioId!],
      });
      if (resultado.rowsAffected === 0) {
        return res.status(404).json({ error: "Tarefa não encontrada." });
      }
      return res.json({ message: "Tarefa excluída com sucesso." });
    } catch (erro) {
      console.error("[EXCLUIR TAREFA]", erro);
      return res
        .status(500)
        .json({ error: "Não foi possível excluir a tarefa." });
    }
  },
);

// Rotas de API desconhecidas devem responder JSON, não o HTML do React.
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Rota de API não encontrada." });
});

// Mantém a entrega do React pelo Express (Aula 08).
app.use(express.static(FRONT_DIST));

app.get(/(.*)/, (_req: Request, res: Response) => {
  if (!fs.existsSync(FRONT_INDEX)) {
    return res.status(503).type("text/plain").send(SEM_BUILD);
  }
  return res.sendFile(FRONT_INDEX);
});

function verificarFront(): void {
  if (!fs.existsSync(FRONT_INDEX)) {
    console.warn(`\n[ATENÇÃO] ${SEM_BUILD}\n`);
    return;
  }
  const fontes = path.join(__dirname, "web", "src");
  if (
    fs.existsSync(fontes) &&
    maisRecente(fontes) > fs.statSync(FRONT_INDEX).mtimeMs
  ) {
    console.warn(
      "\n[ATENÇÃO] O build do front está desatualizado.\n" +
        "          Rode `npm run build:web` para atualizar.\n",
    );
  }
}

async function iniciarServidor(): Promise<void> {
  await inicializarBanco();

  app.listen(PORT, () => {
    exibirBannerBanco();
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
    console.log(`API:   http://localhost:${PORT}/api/health`);
    console.log(`Front: http://localhost:${PORT}`);
    verificarFront();
  });
}

iniciarServidor();
