// server.js

/*
  LEMBRETE DE SEGURANÇA (TODO):
  - Atualmente, as senhas dos usuários são salvas e verificadas em texto plano.
  - É crucial implementar uma solução de hashing (como a biblioteca `bcrypt`) para proteger as senhas.
  - A implementação deve afetar as seguintes rotas:
    1. `POST /api/usuarios`: Criptografar a senha antes de salvar no banco.
    2. `POST /api/login`: Comparar a senha fornecida com o hash salvo no banco.
  - A coluna `password` na tabela `usuarios` precisará ser ajustada para um tamanho maior (ex: VARCHAR(60)).
*/
const express = require('express');
const cors = require('cors'); // Importa o pacote cors
const mysql = require('mysql2');
const dbConfig = require('./config.local.json');

const app = express();
const port = 3000; // Porta em que o servidor vai rodar

// Middleware para habilitar o CORS (deve vir antes das rotas)
app.use(cors());

// Middleware para permitir que o servidor entenda JSON vindo no corpo das requisições
app.use(express.json());

// Arquivos públicos do totem: não expor configurações ou backups da pasta.
for (const arquivo of ['totem.html', 'totem.css', 'totem.js', 'logo.png']) {
  app.get(`/${arquivo}`, (req, res) => res.sendFile(arquivo, { root: __dirname }));
}

// Configuração da conexão com o banco de dados MySQL
// IMPORTANTE: Substitua com suas credenciais reais do MySQL
const db = mysql.createPool({
  connectionLimit: 10, // Limite de conexões no pool
  ...dbConfig
}).promise(); // Usar a versão com Promises para um código mais limpo

// Rota (endpoint) para receber e salvar uma nova senha
app.post('/api/senhas', async (req, res) => {
  // Pega os dados enviados pelo frontend (sem a senha)
  const { servico, medico, consultorio, tipo } = req.body;

  console.log('Requisição para gerar senha para:', { servico, medico, consultorio, tipo });

  // Validação simples para garantir que os dados essenciais foram enviados
  if (!servico) {
    return res.status(400).json({ message: 'Serviço é obrigatório.' });
  }

  try {
    // 1. Descobre a inicial e o último número usado para esse serviço
    const inicialServico = servico.charAt(0).toUpperCase();
    
    // Consulta a última senha para este serviço específico para garantir a sequência correta
    const [rows] = await db.query(
      'SELECT senha FROM senhas WHERE servico = ? ORDER BY id DESC LIMIT 1',
      [servico]
    );

    let sequencia = 1;
    if (rows.length > 0) {
      const ultimaSenha = rows[0].senha;
      // Extrai o número da última senha (ex: "C0005" -> 5) e incrementa
      const ultimoNumero = parseInt(ultimaSenha.substring(1), 10);
      sequencia = ultimoNumero + 1;
    }

    // 2. Formata a nova senha
    const numeroFormatado = String(sequencia).padStart(4, '0');
    const novaSenha = `${inicialServico}${numeroFormatado}`;

    // 3. Insere a nova senha no banco de dados, registrando o horário de geração
    const query = 'INSERT INTO senhas (senha, servico, medico, tipo, consultorio, data_geracao) VALUES (?, ?, ?, ?, ?, NOW(3))';
    await db.query(query, [novaSenha, servico, medico, tipo, consultorio]);

    // 4. Envia a nova senha de volta para o frontend
    res.status(201).json({ message: 'Senha gerada e salva com sucesso!', senha: novaSenha });
  } catch (error) {
    console.error('Erro ao gerar/salvar no banco de dados:', error);
    // Envia uma resposta de erro para o frontend
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota para o painel buscar os dados de atendimento
app.get('/api/painel', async (req, res) => {
  try {
    // Busca as 4 últimas senhas que tiveram uma data de chamada, ordenadas pela mais recente.
    // Isso inclui senhas com status 'chamado' e 'atendido', garantindo que o painel
    // mantenha a última senha chamada mesmo após ser finalizada.
    const [chamados] = await db.query(
      `SELECT senha, servico, consultorio, data_chamada, tipo 
       FROM senhas 
       WHERE data_chamada IS NOT NULL 
       ORDER BY data_chamada DESC 
       LIMIT 4`
    );

    // A senha atual é a primeira da lista (a mais recente).
    const senhaAtual = chamados.length > 0 ? chamados[0] : null;
    
    // O histórico são as senhas seguintes.
    const historico = chamados.length > 1 ? chamados.slice(1) : [];

    res.json({ senhaAtual, historico });

  } catch (error) {
    console.error('Erro ao buscar dados para o painel:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota para o atendente chamar a próxima senha
app.post('/api/chamar', async (req, res) => {
  const guicheId = Number(req.body?.guicheId);
  if (!Number.isSafeInteger(guicheId) || guicheId <= 0) {
    return res.status(400).json({ message: 'Selecione um guichê cadastrado antes de chamar.' });
  }
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [locais] = await connection.query('SELECT nome FROM consultorios WHERE id = ?', [guicheId]);
    if (!locais.length) {
      await connection.rollback();
      return res.status(400).json({ message: 'Guichê não encontrado. Atualize a lista de locais.' });
    }
    // 1. Encontra a próxima senha (prioriza 'preferencial', depois a mais antiga)
    const [rows] = await connection.query(
      "SELECT id, senha, servico, consultorio FROM senhas WHERE status = 'aguardando' ORDER BY tipo DESC, id ASC LIMIT 1 FOR UPDATE"
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Nenhuma senha aguardando para ser chamada.' });
    }

    const proximaSenha = rows[0];

    // 2. Atualiza o status da senha para 'chamado' e registra a hora
    await connection.query(
      "UPDATE senhas SET status = 'chamado', data_chamada = NOW(3), consultorio = ? WHERE id = ?",
      [locais[0].nome, proximaSenha.id]
    );
    proximaSenha.consultorio = locais[0].nome;
    await connection.commit();

    // 3. Retorna a senha que foi chamada
    res.json({ message: 'Senha chamada com sucesso!', senhaChamada: proximaSenha });

  } catch (error) {
    console.error('Erro ao chamar a próxima senha:', error);
    if (connection) await connection.rollback();
    res.status(500).json({ message: 'Erro interno do servidor.' });
  } finally {
    if (connection) connection.release();
  }
});

// Rota para o atendente RECHAMAR a senha atual
app.post('/api/rechamar', async (req, res) => {
    const { senha } = req.body;

    if (!senha) {
        return res.status(400).json({ message: 'Nenhuma senha fornecida para rechamar.' });
    }

    try {
        // Atualiza o timestamp da senha para que ela volte ao topo da lista de chamados
        const [result] = await db.query(
            "UPDATE senhas SET data_chamada = NOW(3) WHERE senha = ? AND status = 'chamado'",
            [senha]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Senha não encontrada ou não está em status de "chamado".' });
        }

        res.json({ message: `Senha ${senha} rechamada com sucesso!` });
    } catch (error) {
        console.error('Erro ao rechamar a senha:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// Rota para o atendente finalizar o atendimento
app.post('/api/finalizar', async (req, res) => {
  const { senha, atendenteId } = req.body;

  if (!senha || !atendenteId) {
    return res.status(400).json({ message: 'Senha e ID do atendente são obrigatórios.' });
  }

  try {
    // Atualiza o status da senha para 'atendido' e registra a hora/atendente
    const [result] = await db.query(
      "UPDATE senhas SET status = 'atendido', data_finalizacao = NOW(3), atendido_por = ? WHERE senha = ? AND status = 'chamado'",
      [atendenteId, senha]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Não foi possível finalizar. Senha não encontrada ou já finalizada.' });
    }

    res.json({ message: `Atendimento da senha ${senha} finalizado.` });
  } catch (error) {
    console.error('Erro ao finalizar atendimento:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota para o atendente marcar como "Não Compareceu"
app.post('/api/nao-compareceu', async (req, res) => {
  const { senha } = req.body;

  if (!senha) {
    return res.status(400).json({ message: 'O número da senha é obrigatório.' });
  }

  try {
    // Atualiza o status da senha para 'cancelado' e registra a hora da ação
    const [result] = await db.query(
      "UPDATE senhas SET status = 'cancelado', data_finalizacao = NOW(3) WHERE senha = ? AND status = 'chamado'",
      [senha]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Não foi possível marcar como não compareceu. Senha não encontrada ou não está em status de "chamado".' });
    }

    res.json({ message: `Senha ${senha} marcada como "não compareceu".` });
  } catch (error) {
    console.error('Erro ao marcar como não compareceu:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota para o atendente buscar a lista de senhas aguardando
app.get('/api/senhas/aguardando', async (req, res) => {
  try {
    // Adicionado TIME_FORMAT(TIMEDIFF(...)) para calcular e formatar o tempo de espera
    const [senhas] = await db.query(
      //"SELECT senha, servico, medico, tipo, TIME_FORMAT(TIMEDIFF(NOW(3), data_geracao), '%H:%i:%s') AS tempo_espera FROM senhas WHERE status = 'aguardando' ORDER BY tipo DESC, id ASC"
      "SELECT s.senha, s.tipo, s.servico, s.medico,s.data_hora, TIMEDIFF(NOW(), s.data_hora) as tempo_espera FROM senhas s WHERE s.status = 'aguardando'ORDER BY s.tipo DESC, s.id ASC"
    );
    res.json(senhas);
  } catch (error) {
    console.error('Erro ao buscar senhas aguardando:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// --- ROTAS PARA DADOS DINÂMICOS ---

// Rota para buscar a lista de serviços
app.get('/api/servicos', async (req, res) => { // Usado no Gerador e no Admin
  try {
    const [servicos] = await db.query("SELECT id, nome FROM servicos ORDER BY nome ASC");
    res.json(servicos);
  } catch (error) {
    console.error('Erro ao buscar serviços:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota para ADICIONAR um novo serviço
app.post('/api/servicos', async (req, res) => {
  const { nome } = req.body;
  if (!nome) { return res.status(400).json({ message: 'O nome do serviço é obrigatório.' }); }
  try {
    await db.query('INSERT INTO servicos (nome) VALUES (?)', [nome]);
    res.status(201).json({ message: 'Serviço adicionado com sucesso!' });
  } catch (error) {
    console.error('Erro ao adicionar serviço:', error);
    res.status(500).json({ message: 'Erro ao adicionar serviço.' });
  }
});

// Rota para EXCLUIR um serviço
app.delete('/api/servicos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM servicos WHERE id = ?', [id]);
    res.json({ message: 'Serviço excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir serviço:', error);
    res.status(500).json({ message: 'Erro ao excluir serviço.' });
  }
});

// Rota para buscar a lista de médicos
app.get('/api/medicos', async (req, res) => { // Usado no Gerador e no Admin
  try {
    const [medicos] = await db.query("SELECT id, nome FROM medicos ORDER BY nome ASC");
    res.json(medicos);
  } catch (error) {
    console.error('Erro ao buscar médicos:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota para ADICIONAR um novo médico
app.post('/api/medicos', async (req, res) => {
  const { nome } = req.body;
  if (!nome) { return res.status(400).json({ message: 'O nome do médico é obrigatório.' }); }
  try {
    await db.query('INSERT INTO medicos (nome) VALUES (?)', [nome]);
    res.status(201).json({ message: 'Médico adicionado com sucesso!' });
  } catch (error) {
    console.error('Erro ao adicionar médico:', error);
    res.status(500).json({ message: 'Erro ao adicionar médico.' });
  }
});

// Rota para EXCLUIR um médico
app.delete('/api/medicos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM medicos WHERE id = ?', [id]);
    res.json({ message: 'Médico excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir médico:', error);
    res.status(500).json({ message: 'Erro ao excluir médico.' });
  }
});

// Rota para buscar a lista de consultórios
app.get('/api/consultorios', async (req, res) => { // Usado no Gerador e no Admin
  try {
    const [consultorios] = await db.query("SELECT id, nome FROM consultorios ORDER BY nome ASC");
    res.json(consultorios);
  } catch (error) {
    console.error('Erro ao buscar consultórios:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota para ADICIONAR um novo consultório
app.post('/api/consultorios', async (req, res) => {
  const { nome } = req.body;
  if (!nome) { return res.status(400).json({ message: 'O nome do consultório é obrigatório.' }); }
  try {
    await db.query('INSERT INTO consultorios (nome) VALUES (?)', [nome]);
    res.status(201).json({ message: 'Consultório adicionado com sucesso!' });
  } catch (error) {
    console.error('Erro ao adicionar consultório:', error);
    res.status(500).json({ message: 'Erro ao adicionar consultório.' });
  }
});

// Rota para EXCLUIR um consultório
app.delete('/api/consultorios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM consultorios WHERE id = ?', [id]);
    res.json({ message: 'Consultório excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir consultório:', error);
    res.status(500).json({ message: 'Erro ao excluir consultório.' });
  }
});

// --- ROTAS PARA RELATÓRIOS ---

// Rota para buscar dados para o gráfico de atendimentos por serviço
app.get('/api/relatorios/atendimentos-por-servico', async (req, res) => {
  try {
    const [dados] = await db.query(`
      SELECT
        servico,
        COUNT(*) AS total
      FROM
        senhas
      WHERE
        status = 'atendido' AND data_finalizacao >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY
        servico
      ORDER BY
        total DESC
    `);
    res.json(dados);
  } catch (error) {
    console.error('Erro ao buscar dados do relatório:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota para buscar dados para o gráfico de atendimentos por serviço (HOJE)
app.get('/api/relatorios/atendimentos-hoje', async (req, res) => {
  try {
    const [dados] = await db.query(`
      SELECT
        servico,
        COUNT(*) AS total
      FROM
        senhas
      WHERE
        status = 'atendido' AND DATE(data_finalizacao) = CURDATE()
      GROUP BY
        servico
      ORDER BY
        total DESC
    `);
    res.json(dados);
  } catch (error) {
    console.error('Erro ao buscar dados do relatório do dia:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota para buscar senhas canceladas no dia
app.get('/api/relatorios/senhas-canceladas-hoje', async (req, res) => {
  try {
    // Agrupa as senhas canceladas por serviço e conta o total de cada um
    const [dados] = await db.query(`
      SELECT
        servico,
        COUNT(*) AS total
      FROM
        senhas
      WHERE
        status = 'cancelado' AND DATE(data_finalizacao) = CURDATE()
      GROUP BY
        servico
      ORDER BY
        total DESC
    `);
    res.json(dados);
  } catch (error) {
    console.error('Erro ao buscar senhas canceladas do dia:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota para buscar todos os usuários (sem a senha)
app.get('/api/usuarios', async (req, res) => {
  try {
    const [usuarios] = await db.query(
      "SELECT id, nome_completo, username, perfil FROM usuarios ORDER BY nome_completo ASC"
    );
    res.json(usuarios);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota para excluir um usuário
app.delete('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
    res.json({ message: 'Usuário excluído com sucesso!' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    res.status(500).json({ message: 'Erro ao excluir usuário.' });
  }
});

// Rota para criar um novo usuário (acessível pelo admin)
app.post('/api/usuarios', async (req, res) => {
  const { nome_completo, username, password, perfil } = req.body;

  // 1. Validação dos dados de entrada
  if (!nome_completo || !username || !password || !perfil) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  if (perfil !== 'atendente' && perfil !== 'administrador') {
    return res.status(400).json({ message: 'Perfil inválido.' });
  }

  try {
    // 2. Verifica se o username já existe
    const [existingUser] = await db.query(
      'SELECT id FROM usuarios WHERE username = ?',
      [username]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({ message: 'Este nome de usuário já está em uso.' });
    }

    // 3. Insere o novo usuário no banco
    // Lembrete de segurança: A senha está sendo salva em texto plano.
    await db.query(
      'INSERT INTO usuarios (nome_completo, username, password, perfil) VALUES (?, ?, ?, ?)',
      [nome_completo, username, password, perfil]
    );

    res.status(201).json({ message: `Usuário "${username}" criado com sucesso!` });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Rota para autenticação do atendente
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
  }

  try {
    // IMPORTANTE: Esta é uma verificação de senha em texto plano.
    // Em um ambiente de produção, você DEVE usar hashes de senha (ex: com a biblioteca bcrypt).
    const [rows] = await db.query(
      'SELECT id, nome_completo, perfil FROM usuarios WHERE username = ? AND password = ?',
      [username, password]
    );

    if (rows.length > 0) {
      const usuario = rows[0];
      // Login bem-sucedido
      res.json({ success: true, message: 'Login realizado com sucesso!', usuario });
    } else {
      // Credenciais inválidas
      res.status(401).json({ success: false, message: 'Usuário ou senha inválidos.' });
    }
  } catch (error) {
    console.error('Erro no processo de login:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// Função para iniciar o servidor e testar a conexão com o banco
async function startServer() {
  try {
    // Tenta pegar uma conexão para testar as credenciais
    const connection = await db.getConnection();
    console.log('Conexão com o banco de dados MySQL estabelecida com sucesso.');
    connection.release(); // Libera a conexão de volta para o pool

    app.listen(port, () => {
      console.log(`Servidor rodando em http://localhost:${port}`);
    });
  } catch (error) {
    console.error('ERRO: Não foi possível conectar ao banco de dados.');
    console.error(`Mensagem: ${error.message}`);
    console.error('Verifique suas credenciais no arquivo server.js e se o serviço do MySQL está em execução.');
    process.exit(1); // Encerra o processo se não conseguir conectar
  }
}

startServer();
