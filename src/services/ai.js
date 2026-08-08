import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const SYSTEM_PROMPT = [
  'Você é um assistente dentro de um servidor do Discord.',
  'Responda sempre em português do Brasil, de forma direta e amigável.',
  'Sua resposta é exibida em um embed do Discord, então:',
  '- mantenha-a abaixo de 3500 caracteres;',
  '- use markdown do Discord (**negrito**, `código`, listas) e evite tabelas;',
  '- vá direto ao ponto, sem preâmbulos do tipo "claro!" ou "ótima pergunta".',
  'Se não souber algo, diga que não sabe em vez de inventar.',
].join('\n');

export const isEnabled = Boolean(config.anthropic.apiKey);

const client = isEnabled ? new Anthropic({ apiKey: config.anthropic.apiKey }) : null;

// Fallback automático: se os classificadores recusarem o pedido, a própria API
// tenta outro modelo. Se a conta ainda não tiver esse beta liberado, a primeira
// chamada devolve 400 e desligamos o recurso pelo resto do processo.
let useServerFallback = true;

/**
 * Envia uma pergunta ao Claude e devolve { text } ou { error }.
 * Nunca lança — o comando /ia trata o retorno.
 */
export async function ask(prompt, { username } = {}) {
  if (!client) return { error: 'O comando de IA não está configurado neste bot.' };

  const request = {
    model: config.anthropic.model,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    // Efeito prático: respostas rápidas e baratas, adequadas a um chat.
    output_config: { effort: 'low' },
    messages: [
      {
        role: 'user',
        content: username ? `[Pergunta de ${username}]\n${prompt}` : prompt,
      },
    ],
  };

  try {
    const response = await send(request);

    if (response.stop_reason === 'refusal') {
      return { error: 'Não consigo responder a esse pedido. Tente reformular a pergunta.' };
    }

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!text) return { error: 'O modelo devolveu uma resposta vazia. Tente de novo.' };

    return { text, model: response.model, usage: response.usage };
  } catch (error) {
    logger.error('Falha na chamada à API da Anthropic:', error.message);

    if (error.status === 401) return { error: 'A chave da API da Anthropic é inválida.' };
    if (error.status === 429) return { error: 'Limite de uso atingido. Tente novamente em instantes.' };
    if (error.status >= 500) return { error: 'A API está sobrecarregada. Tente novamente em instantes.' };

    return { error: 'Não foi possível falar com a IA agora.' };
  }
}

async function send(request) {
  if (!useServerFallback) return client.messages.create(request);

  try {
    return await client.beta.messages.create({
      ...request,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
  } catch (error) {
    if (error.status !== 400) throw error;
    logger.warn('Fallback automático indisponível nesta conta; seguindo sem ele.');
    useServerFallback = false;
    return client.messages.create(request);
  }
}
