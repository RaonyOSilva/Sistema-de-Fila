'use strict';
const api = location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api';
const el = id => document.getElementById(id);
let emitindo = false;
let retorno;
let servicoSelecionado = null;

function selecionarServico(servico) {
  if (emitindo) return;
  servicoSelecionado = servico;
  el('servicoSelecionado').textContent = servico;
  el('statusEmissao').textContent = '';
  el('selecao').hidden = true;
  el('selecaoTipo').hidden = false;
  el('tituloTipo').focus();
  agendarRetorno();
}

async function carregarServicos() {
  el('recarregar').hidden = true;
  el('status').textContent = 'Carregando serviços…';
  el('servicos').replaceChildren();
  try {
    const resposta = await fetch(`${api}/servicos`, { signal: AbortSignal.timeout(15000) });
    if (!resposta.ok) throw new Error();
    const servicos = await resposta.json();
    if (!Array.isArray(servicos)) throw new Error();
    for (const servico of servicos) {
      const botao = document.createElement('button');
      botao.textContent = servico.nome;
      botao.addEventListener('click', () => selecionarServico(servico.nome));
      el('servicos').appendChild(botao);
    }
    el('status').textContent = servicos.length ? '' : 'Nenhum serviço disponível. Procure a recepção.';
    el('recarregar').hidden = servicos.length > 0;
  } catch {
    el('status').textContent = 'Não foi possível carregar os serviços. Tente novamente ou procure a recepção.';
    el('recarregar').hidden = false;
  }
}

function agendarRetorno() {
  clearTimeout(retorno);
  retorno = setTimeout(reiniciar, el('resultado').hidden ? 45000 : 8000);
}

function imprimir() {
  clearTimeout(retorno);
  try { window.print(); }
  catch { el('impressaoStatus').textContent = 'Não foi possível abrir a impressão. Sua senha já foi emitida.'; }
  agendarRetorno();
}

async function emitir(tipo) {
  if (emitindo || !servicoSelecionado) return;
  const servico = servicoSelecionado;
  clearTimeout(retorno);
  emitindo = true;
  el('selecaoTipo').querySelectorAll('button').forEach(botao => { botao.disabled = true; });
  el('servicos').querySelectorAll('button').forEach(botao => { botao.disabled = true; });
  el('statusEmissao').textContent = 'Emitindo sua senha…';
  try {
    const resposta = await fetch(`${api}/senhas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ servico, tipo, medico: null, consultorio: null }),
      signal: AbortSignal.timeout(20000)
    });
    const dados = await resposta.json();
    if (!resposta.ok || typeof dados.senha !== 'string') throw new Error();
    const tipoTexto = tipo === 'preferencial' ? 'Preferencial' : 'Normal';
    el('numero').textContent = dados.senha;
    el('descricao').textContent = `${servico} • ${tipoTexto}`;
    el('ticketNumero').textContent = dados.senha;
    el('ticketServico').textContent = servico;
    el('ticketTipo').textContent = tipoTexto;
    el('ticketData').textContent = new Date().toLocaleString('pt-BR');
    el('selecao').hidden = true;
    el('selecaoTipo').hidden = true;
    el('resultado').hidden = false;
    el('impressaoStatus').textContent = 'Retire o comprovante na impressora.';
    el('tituloResultado').focus();
    imprimir();
  } catch {
    // Não repetir automaticamente: o servidor pode ter gravado antes da falha de rede.
    el('statusEmissao').textContent = 'Não foi possível confirmar a emissão. Procure a recepção antes de tentar novamente, para evitar duas senhas.';
  }
}

function reiniciar() {
  clearTimeout(retorno);
  emitindo = false;
  servicoSelecionado = null;
  el('selecaoTipo').hidden = true;
  el('selecaoTipo').querySelectorAll('button').forEach(botao => { botao.disabled = false; });
  el('resultado').hidden = true;
  el('selecao').hidden = false;
  carregarServicos();
}
el('recarregar').addEventListener('click', carregarServicos);
el('tipoNormal').addEventListener('click', () => emitir('normal'));
el('tipoPreferencial').addEventListener('click', () => emitir('preferencial'));
el('voltarServicos').addEventListener('click', () => { if (!emitindo) reiniciar(); });
window.addEventListener('afterprint', agendarRetorno);
carregarServicos();
