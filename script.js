document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/api/painel';

    // Elementos do DOM
    const senhaAtualEl = document.getElementById('senhaAtual');
    const servicoAtualEl = document.getElementById('servicoAtual');
    const guicheAtualEl = document.getElementById('guicheAtual');
    const tipoSenhaEl = document.getElementById('tipoSenha');
    const historicoDiv = document.getElementById('historicoAtendimentos');
    const orientacaoDestino = document.getElementById('orientacaoDestino');
    const horaAtual = document.getElementById('horaAtual');
    const dataAtual = document.getElementById('dataAtual');
    const formatoHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const formatoData = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });

    function atualizarRelogio() {
        const agora = new Date();
        horaAtual.textContent = formatoHora.format(agora);
        horaAtual.dateTime = agora.toISOString();
        dataAtual.textContent = formatoData.format(agora);
    }
    atualizarRelogio();
    setInterval(atualizarRelogio, 1000);

    // Variáveis de estado para controlar a última senha e a fala
    let ultimaDataChamada = null;
    let isSpeaking = false;
    let ultimoHistorico = null;

    /**
     * Usa a API de Síntese de Voz do navegador para falar um texto.
     * @param {string} texto O texto a ser falado.
     */
    function falar(texto) {
        if (!('speechSynthesis' in window)) {
            console.warn('Seu navegador não suporta a síntese de voz.');
            return;
        }
        if (isSpeaking) {
            return; // Evita sobreposição de falas
        }

        speechSynthesis.cancel(); // Cancela qualquer fala pendente

        const utterance = new SpeechSynthesisUtterance(texto);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.0; // Velocidade da fala (1.0 é normal)
        utterance.onstart = () => { isSpeaking = true; };
        utterance.onend = () => { isSpeaking = false; };

        speechSynthesis.speak(utterance);
    }

    /**
     * Adiciona a classe 'blinking' para o efeito de piscar.
     * A animação agora para sozinha via CSS.
     */
    function piscarSenha() {
        const wrapper = senhaAtualEl.parentElement;
        // Remove a classe para garantir que a animação possa ser reiniciada
        wrapper.classList.remove('blinking');
        // Este é um truque para forçar o navegador a "ver" a remoção da classe antes de adicioná-la novamente
        void wrapper.offsetWidth;
        // Adiciona a classe para iniciar o efeito de piscar
        wrapper.classList.add('blinking');
    }

    function atualizarPainel() {
        fetch(API_URL)
            .then(response => {
                if (!response.ok) {
                    if (response.status === 404) return { senhaAtual: null, historico: [] };
                    throw new Error('Erro de rede ao buscar dados do painel');
                }
                return response.json();
            })
            .then(data => {
                const { senhaAtual, historico } = data;

                // 1. ATUALIZA A TELA com os dados mais recentes recebidos do servidor
                if (senhaAtual) {
                    // Define a cor e o texto da senha (preferencial ou normal)
                    if (senhaAtual.tipo === 'preferencial') {
                        senhaAtualEl.classList.add('preferencial');
                        tipoSenhaEl.textContent = 'Atendimento Preferencial';
                    } else {
                        senhaAtualEl.classList.remove('preferencial');
                        tipoSenhaEl.textContent = ''; // Limpa o indicador para senhas normais
                    }
                    // Atualiza os textos
                    senhaAtualEl.textContent = senhaAtual.senha;
                    servicoAtualEl.textContent = senhaAtual.servico;
                    orientacaoDestino.hidden = !senhaAtual.consultorio;
                    guicheAtualEl.textContent = senhaAtual.consultorio || 'Local não informado';
                } else if (!senhaAtual) {
                    // Limpa a tela se não houver nenhuma senha para mostrar
                    senhaAtualEl.textContent = '----';
                    senhaAtualEl.classList.remove('preferencial'); // Garante que a cor volte ao normal
                    tipoSenhaEl.textContent = '';
                    servicoAtualEl.textContent = 'Nenhuma senha em atendimento';
                    guicheAtualEl.textContent = 'Aguardando...';
                    orientacaoDestino.hidden = true;
                }

                // 2. DISPARA OS EFEITOS (som e pisca-pisca) apenas se for uma nova chamada/rechamada
                if (senhaAtual && senhaAtual.data_chamada !== ultimaDataChamada) {
                    ultimaDataChamada = senhaAtual.data_chamada;
                    piscarSenha();
                    const textoParaFalar = `Senha ${senhaAtual.senha}, ${senhaAtual.consultorio}`;
                    falar(textoParaFalar);
                } else if (!senhaAtual) {
                    ultimaDataChamada = null; // Reseta se não houver atendimento
                }

                // Atualiza o histórico
                const itens = Array.isArray(historico) ? historico : [];
                const assinatura = JSON.stringify(itens);
                if (assinatura !== ultimoHistorico) {
                    const fragmento = document.createDocumentFragment();
                    itens.forEach(item => {
                        const cartao = document.createElement('div');
                        cartao.className = 'historico-item';
                        cartao.setAttribute('role', 'listitem');
                        const numero = document.createElement('span');
                        numero.className = 'historico-senha';
                        numero.textContent = item.senha;
                        const destino = document.createElement('span');
                        destino.className = 'historico-destino';
                        destino.textContent = item.consultorio || 'Local não informado';
                        cartao.append(numero, destino);
                        fragmento.appendChild(cartao);
                    });
                    if (!itens.length) {
                        const vazio = document.createElement('p');
                        vazio.className = 'historico-vazio';
                        vazio.textContent = 'Aguardando as próximas chamadas';
                        fragmento.appendChild(vazio);
                    }
                    historicoDiv.replaceChildren(fragmento);
                    ultimoHistorico = assinatura;
                }
            })
            .catch(error => {
                console.error('Falha ao atualizar o painel:', error);
            });
    }

    // Inicia a atualização e a repete a cada 5 segundos
    atualizarPainel();
    setInterval(atualizarPainel, 5000);
});
