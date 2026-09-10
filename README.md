# Sistema de filas

Sistema em desenvolvimento com Node.js, Express, MySQL e páginas HTML para emissão, atendimento, painel de chamadas e administração.

## Preparação local

1. Instale Node.js e MySQL e execute `npm install` nesta pasta.
2. Copie `config.example.json` para `config.local.json` e preencha as credenciais locais.
3. Crie o banco indicado na configuração e importe `banco/schema.sql` no banco vazio. Esse arquivo contém apenas a estrutura, sem usuários ou dados de atendimento.
4. Execute `node server.js` para iniciar a API na porta 3000.

As páginas HTML ainda precisam ser abertas ou servidas separadamente e apontam para `localhost:3000`. A instalação em rede será ajustada durante o desenvolvimento.

## Estado atual

## Totem de autoatendimento

Reinicie `node server.js` e abra `http://localhost:3000/totem.html`. Em tablets ou outros computadores da rede, substitua `localhost` pelo IP do servidor. A tela não exige login, consulta os serviços cadastrados e permite atendimento normal ou preferencial. Médico e consultório são enviados como nulos: o fluxo de direcionamento para uma sala ainda precisa ser definido.

Ao emitir, a tela abre a impressão do navegador. Selecione a impressora e o tamanho do papel nas configurações do equipamento. Impressão silenciosa exige configuração específica do navegador/totem; a página sozinha não garante impressão física. Reimprimir reutiliza a senha já emitida. A tela retorna à seleção após 45 segundos ou ao tocar em Concluir. Em falha de confirmação da emissão, os botões ficam bloqueados para evitar duplicidade; a recepção deve conferir a fila antes de recarregar a página.

## Pendências de produção

## Guichê do atendente

Na tela do atendente, selecione o local antes de chamar. Os guichês reutilizam o cadastro de consultórios: cadastre nomes como `Guichê 1` e `Guichê 2` na administração. A chamada grava esse nome como destino da senha, substituindo qualquer destino informado na emissão; painel, voz e histórico usam esse destino. Finalize o atendimento ou marque ausência antes de trocar o guichê ou chamar outra senha. A seleção deve ser refeita ao recarregar a página. Não há reserva exclusiva de guichê entre atendentes nesta versão.

Ainda não está pronto para produção: falta proteger as rotas com autenticação e autorização, aplicar hashing às senhas e garantir operações concorrentes na fila. Não há testes automatizados configurados. A criação inicial segura do administrador ainda precisa ser implementada.

Configurações locais, dependências e backups SQL com dados são ignorados pelo Git. Preserve seus backups separadamente.
