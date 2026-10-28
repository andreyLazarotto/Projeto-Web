# Gerenciador de Tarefas — Projeto Web

#📌 Sobre o projeto

Este projeto foi desenvolvido como parte das aulas de desenvolvimento Web, com o objetivo de praticar a criação de uma aplicação completa utilizando React no front-end e Node.js com Express no back-end.

O sistema permite que os usuários acessem a aplicação por meio de uma tela de login ou cadastro e gerenciem suas tarefas em uma interface web.

# 🚀 Tecnologias utilizadas

React + TypeScript: criação da interface e dos componentes.

Vite: ambiente de desenvolvimento e compilação do front-end.

Node.js + Express: servidor e rotas do back-end.

JWT: autenticação por token.

bcrypt: proteção das senhas por meio de hash.

npm: instalação e gerenciamento das dependências.

#⚙️ Funcionalidades

Cadastro e login de usuários.

Validação dos dados de autenticação.

Proteção de rotas por meio de autenticação.

Criação, consulta, edição e exclusão de tarefas (CRUD).

Comunicação entre o front-end e a API.

Servidor Express configurado para disponibilizar a aplicação React após a compilação.

# 💻 Como executar o projeto

1. Pré-requisitos

Instale o Node.js (versão LTS recomendada), que já inclui o npm.

2. Instalar as dependências

Abra o terminal na pasta principal do projeto e execute:

## npm install
## npm --prefix web install

3. Compilar o front-end

Execute os comandos:

## npm run build
## npm run build:web

Esses comandos verificam e compilam o código para preparar a aplicação.

4. Iniciar o servidor

Execute:

## npm run dev

Após iniciar o servidor, acesse no navegador:

## http://localhost:3000

Caso algum comando apresente erro, verifique a mensagem exibida no terminal e confirme se está na pasta principal do projeto.

# 📁 Estrutura do projeto

web/ — aplicação front-end em React e TypeScript.

web/src/ — componentes, telas e lógica da interface.

server.ts — configuração do servidor Express.

package.json — dependências e scripts de execução.

.gitignore — arquivos e pastas que não devem ser enviados ao Git.

🎯 Objetivo das aulas

O desenvolvimento permite praticar a integração entre front-end e back-end, o uso de autenticação, a manipulação de dados por meio de operações CRUD e a configuração de um servidor para disponibilizar a aplicação web.

👨‍💻 Considerações finais

O projeto reúne os principais conceitos estudados nas aulas, permitindo compreender como as diferentes tecnologias trabalham juntas para construir uma aplicação web funcional e organizada.
