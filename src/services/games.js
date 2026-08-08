import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Estado dos jogos em memória, indexado pelo ID da mensagem.
 * Jogo é efêmero por natureza: se o bot reiniciar, a partida acaba — por isso
 * não vai para o banco. Um coletor periódico limpa partidas abandonadas.
 */
const games = new Map();

const GAME_TTL = 15 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - GAME_TTL;
  for (const [id, game] of games) {
    if (game.updatedAt < cutoff) games.delete(id);
  }
}, 60_000).unref();

export function getGame(messageId) {
  return games.get(messageId);
}

export function setGame(messageId, game) {
  games.set(messageId, { ...game, updatedAt: Date.now() });
}

export function deleteGame(messageId) {
  games.delete(messageId);
}

// ---------------------------------------------------------------- jogo da velha

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const MARKS = ['❌', '⭕'];

/** Devolve { winner: 0|1, line } , 'empate' ou null se o jogo continua. */
export function checkWinner(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] !== null && board[a] === board[b] && board[b] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return board.every((cell) => cell !== null) ? 'empate' : null;
}

/** Monta as três linhas de botões do tabuleiro. */
export function boardRows(messageId, board, { disabled = false, highlight = [] } = {}) {
  const rows = [];

  for (let row = 0; row < 3; row += 1) {
    const buttons = [];
    for (let column = 0; column < 3; column += 1) {
      const index = row * 3 + column;
      const value = board[index];

      const button = new ButtonBuilder()
        .setCustomId(`ttt:play:${messageId}:${index}`)
        .setStyle(
          highlight.includes(index)
            ? ButtonStyle.Success
            : value === null
              ? ButtonStyle.Secondary
              : ButtonStyle.Primary,
        )
        .setDisabled(disabled || value !== null);

      if (value === null) button.setLabel('​');
      else button.setEmoji(MARKS[value]);

      buttons.push(button);
    }
    rows.push(new ActionRowBuilder().addComponents(buttons));
  }

  return rows;
}

// ------------------------------------------------------------------------ quiz

export const QUIZ_QUESTIONS = [
  { q: 'Qual é o maior planeta do Sistema Solar?', options: ['Júpiter', 'Saturno', 'Netuno', 'Terra'], answer: 0 },
  { q: 'Em que ano o Brasil foi campeão da Copa do Mundo pela primeira vez?', options: ['1950', '1958', '1962', '1970'], answer: 1 },
  { q: 'Qual é o rio mais extenso do mundo?', options: ['Nilo', 'Amazonas', 'Mississipi', 'Yangtzé'], answer: 1 },
  { q: 'Quantos ossos tem o corpo humano adulto?', options: ['186', '206', '226', '246'], answer: 1 },
  { q: 'Qual é a capital da Austrália?', options: ['Sydney', 'Melbourne', 'Camberra', 'Perth'], answer: 2 },
  { q: 'Qual desses elementos tem o símbolo químico "Fe"?', options: ['Flúor', 'Ferro', 'Fósforo', 'Frâncio'], answer: 1 },
  { q: 'Quem escreveu "Dom Casmurro"?', options: ['José de Alencar', 'Machado de Assis', 'Graciliano Ramos', 'Jorge Amado'], answer: 1 },
  { q: 'Qual é o menor país do mundo em área?', options: ['Mônaco', 'Nauru', 'Vaticano', 'San Marino'], answer: 2 },
  { q: 'Quantos lados tem um heptágono?', options: ['5', '6', '7', '8'], answer: 2 },
  { q: 'Qual é o oceano que banha a costa brasileira?', options: ['Pacífico', 'Índico', 'Ártico', 'Atlântico'], answer: 3 },
  { q: 'Em que estado brasileiro fica o Parque Nacional dos Lençóis Maranhenses?', options: ['Piauí', 'Maranhão', 'Ceará', 'Bahia'], answer: 1 },
  { q: 'Qual linguagem de programação roda este bot?', options: ['Python', 'JavaScript', 'Rust', 'Go'], answer: 1 },
  { q: 'Qual é o planeta conhecido como Planeta Vermelho?', options: ['Vênus', 'Marte', 'Mercúrio', 'Júpiter'], answer: 1 },
  { q: 'Quantos minutos tem um jogo de futebol (tempo regulamentar)?', options: ['80', '90', '100', '120'], answer: 1 },
  { q: 'Qual é a moeda oficial do Japão?', options: ['Won', 'Yuan', 'Iene', 'Dong'], answer: 2 },
];

export const QUIZ_LETTERS = ['🇦', '🇧', '🇨', '🇩'];
export const QUIZ_TIMEOUT = 30_000;
export const QUIZ_REWARD = 150;

/** Sorteia uma pergunta e embaralha as alternativas. */
export function drawQuestion() {
  const source = QUIZ_QUESTIONS[Math.floor(Math.random() * QUIZ_QUESTIONS.length)];

  const shuffled = source.options.map((text, index) => ({ text, correct: index === source.answer }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }

  return {
    question: source.q,
    options: shuffled.map((option) => option.text),
    answer: shuffled.findIndex((option) => option.correct),
  };
}

/** Botões A/B/C/D do quiz. */
export function quizRow(messageId, options, { disabled = false, answer = null } = {}) {
  return new ActionRowBuilder().addComponents(
    options.map((_, index) =>
      new ButtonBuilder()
        .setCustomId(`quiz:answer:${messageId}:${index}`)
        .setEmoji(QUIZ_LETTERS[index])
        .setStyle(
          answer !== null && index === answer ? ButtonStyle.Success : ButtonStyle.Secondary,
        )
        .setDisabled(disabled),
    ),
  );
}
