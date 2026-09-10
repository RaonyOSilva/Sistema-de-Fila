# Sistema de filas

Sistema em desenvolvimento com Node.js, Express, MySQL e páginas HTML para emissão, atendimento, painel de chamadas e administração.

## Preparação local

1. Instale Node.js e MySQL e execute `npm install` nesta pasta.
2. Copie `config.example.json` para `config.local.json` e preencha as credenciais locais.
3. Crie o banco indicado na configuração e importe `banco/schema.sql` no banco vazio. Esse arquivo contém apenas a estrutura, sem usuários ou dados de atendimento.
4. Execute `node server.js` para iniciar a API na porta 3000.

As páginas HTML ainda precisam ser abertas ou servidas separadamente e apontam para `localhost:3000`. A instalação em rede será ajustada durante o desenvolvimento.

## Estado atual

Ainda não está pronto para produção: falta proteger as rotas com autenticação e autorização, aplicar hashing às senhas e garantir operações concorrentes na fila. Não há testes automatizados configurados. A criação inicial segura do administrador ainda precisa ser implementada.

Configurações locais, dependências e backups SQL com dados são ignorados pelo Git. Preserve seus backups separadamente.
