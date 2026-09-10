'use strict';
const api = location.protocol === 'file:' ? 'http://localhost:3000/api' : '/api';
const el = id => document.getElementById(id);
let emitindo = false;
let retorno;

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
      botao.addEventListener('click', () => emitir(servico.nome));
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
  retorno = setTimeout(reiniciar, 45000);
}

function imprimir() {
  clearTimeout(retorno);
  try { window.print(); }
  catch { el('impressaoStatus').textContent = 'Não foi possível abrir a impressão. Sua senha já foi emitida.'; }
  agendarRetorno();
}

async function emitir(servico) {
  if (emitindo) return;
  emitindo = true;
  el('tipo').disabled = true;
  el('servicos').querySelectorAll('button').forEach(botao => { botao.disabled = true; });
  el('status').textContent = 'Emitindo sua senha…';
  const tipo = document.querySelector('input[name="tipo"]:checked').value;
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
    el('resultado').hidden = false;
    el('impressaoStatus').textContent = 'Retire o comprovante na impressora.';
    el('nova').focus();
    imprimir();
  } catch {
    // Não repetir automaticamente: o servidor pode ter gravado antes da falha de rede.
    el('status').textContent = 'Não foi possível confirmar a emissão. Procure a recepção antes de tentar novamente, para evitar duas senhas.';
  }
}

function reiniciar() {
  clearTimeout(retorno);
  emitindo = false;
  el('tipo').disabled = false;
  document.querySelector('input[value="normal"]').checked = true;
  el('resultado').hidden = true;
  el('selecao').hidden = false;
  carregarServicos();
}
el('recarregar').addEventListener('click', carregarServicos);
el('reimprimir').addEventListener('click', imprimir);
el('nova').addEventListener('click', reiniciar);
window.addEventListener('afterprint', agendarRetorno);
carregarServicos();
