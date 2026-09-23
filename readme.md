README:
Estrutura modelo para o arquivo MD do diário:
# Aula 05 — Adicionando Autenticação e Segurança (Registro e Login) (23/09/2026)

## ✅ O que eu aprendi
eu aprendi como adicionar autenticação e segurança em uma aplicação, principalmente no cadastro e login de usuários. Entendi que as senhas não devem ser salvas diretamente no banco, mas sim transformadas em um hash usando o bcrypt.

## 🧩 Principal dificuldade
Dificuldade como funciona o processo de registro e login, principalmente a diferença entre a senha original e o hash gerado pelo bcrypt e como o JWT é criado depois que o usuário faz login corretamente.

## 🔧 Como eu resolvi
Seguindo as etapas da aula e fazendo as validações antes de cadastrar ou realizar o login. Também o sistema verifica a senha usando o hash, impede e-mails duplicados e, quando o login está correto, gera um token JWT com validade de 2 horas.
## 💡Observações (opcional)
Que é muito importante nunca armazenar senhas em texto puro e que o JWT_SECRET deve ser protegido e utilizado por meio de variáveis de ambiente em produção.

