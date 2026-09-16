README:
Estrutura modelo para o arquivo MD do diário:
# Aula 04 —Evoluindo a Segurança das Rotas de Escrita (16/09/2026)

## ✅ O que eu aprendi
Hoje eu aprendi sobre como aumentar a segurança das rotas de escrita de uma API, principalmente nas operações post, put, patch e delete e que a importância de validar os tipos dos dados, normalizar valores permitidos e centralizar a validação de IDs com funções auxiliares.

## 🧩 Principal dificuldade
Dificuldade como proteger as rotas contra dados maliciosos e como diferenciar os tratamentos de cada operação. Como é a primeira vez fazendo algo assim.

## 🔧 Como eu resolvi
É necessário validar os dados antes de permitir que eles cheguem ao banco, e que o sistema deve retornar erros genéricos para o cliente, enquanto os detalhes reais ficam registrados nos logs do servidor.

## 💡Observações (opcional)
Que é sempre importante evitar SQL Injection, garantir que alterações sejam feitas de forma segura e utilizar rollback quando uma operação falhar. 