document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/api/painel';

    // Elementos do DOM
    const senhaAtualEl = document.getElementById('senhaAtual');
    const servicoAtualEl = document.getElementById('servicoAtual');
    const guicheAtualEl = document.getElementById('guicheAtual');
    const tipoSenhaEl = document.getElementById('tipoSenha');
    const historicoDiv = document.getElementById('historicoAtendimentos');

    // Variáveis de estado para controlar a última senha e a fala
    let ultimaDataChamada = null;
    let isSpeaking = false;

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
                    guicheAtualEl.textContent = `Dirija-se ao ${senhaAtual.consultorio}`;
                } else if (!senhaAtual) {
                    // Limpa a tela se não houver nenhuma senha para mostrar
                    senhaAtualEl.textContent = '----';
                    senhaAtualEl.classList.remove('preferencial'); // Garante que a cor volte ao normal
                    tipoSenhaEl.textContent = '';
                    servicoAtualEl.textContent = 'Nenhuma senha em atendimento';
                    guicheAtualEl.textContent = 'Aguardando...';
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
                historicoDiv.innerHTML = '<p><strong>Últimos atendimentos:</strong></p>'; // Limpa e adiciona o título
                historico.forEach(item => {
                    const p = document.createElement('p');
                    p.textContent = `${item.senha} - ${item.consultorio}`;
                    historicoDiv.appendChild(p);
                });
            })
            .catch(error => {
                console.error('Falha ao atualizar o painel:', error);
            });
    }

    // Inicia a atualização e a repete a cada 5 segundos
    atualizarPainel();
    setInterval(atualizarPainel, 5000);
});
