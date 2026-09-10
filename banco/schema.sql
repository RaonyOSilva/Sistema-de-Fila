-- Estrutura sem dados. Importe em um banco vazio.
SET NAMES utf8mb4;

CREATE TABLE `consultorios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `medicos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `senhas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `senha` varchar(10) NOT NULL,
  `servico` varchar(255) NOT NULL,
  `medico` varchar(255) DEFAULT NULL,
  `tipo` varchar(20) NOT NULL DEFAULT 'normal',
  `atendido_por` int DEFAULT NULL,
  `consultorio` varchar(255) DEFAULT NULL,
  `data_hora` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('aguardando','chamado','atendido','cancelado') DEFAULT 'aguardando',
  `data_chamada` datetime(3) DEFAULT NULL,
  `data_finalizacao` datetime(3) DEFAULT NULL,
  `data_geracao` datetime(3) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `servicos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `nome_completo` varchar(100) DEFAULT NULL,
  `perfil` enum('administrador','atendente') NOT NULL DEFAULT 'atendente',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;