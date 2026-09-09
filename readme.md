README:
Estrutura modelo para o arquivo MD do diário:
# Aula 00 — Ambiente e primeiros passos (09/09/2026)

## ✅ O que eu aprendi
Hoje eu aprendi sobre sanitização e segurança de dados em aplicações. Entendi a importância de validar e tratar os dados recebidos pelo sistema para evitar problemas de segurança, principalmente em consultas ao banco de dados e parâmetros enviados pela URL. Também aprendi sobre Prepared Statements, funções helpers, coerção segura de tipos e validação de entradas.

## 🧩 Principal dificuldade
A principal dificuldade foi entender como dados malformados ou parâmetros inesperados podem causar problemas no sistema, como SQL Injection, manipulação de consultas e erros em rotas GET. Também foi um pouco difícil entender a diferença entre simplesmente receber um dado e realmente validá-lo antes de utilizá-lo.

## 🔧 Como eu resolvi
Eu entendi que a melhor forma de evitar esses problemas é não confiar diretamente nos dados recebidos pelo usuário. Para isso, utilizei validações, conversão segura de tipos, funções auxiliares e Prepared Statements para separar os dados dos comandos SQL. Também aprendi a tratar os parâmetros das rotas antes de utilizá-los no sistema.

## 💡Observações (opcional)
A aula mostrou que a segurança precisa ser pensada desde o desenvolvimento da aplicação. Pequenos cuidados com a entrada de dados podem evitar problemas maiores, principalmente quando o sistema trabalha com banco de dados e requisições externas.