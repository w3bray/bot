/**
 * Uma "rota" é um caminho que a pessoa consegue digitar e executar.
 *
 * `client.commands.size` conta os comandos de topo — hoje 100, o teto do
 * Discord. Mas cada família guarda até 25 subcomandos, e é a soma deles que
 * responde "quantos comandos o bot tem". Contar errado aqui produz mensagens
 * que se contradizem entre `/ajuda` e a apresentação em servidor novo.
 */

import { nomeLocalizado } from './localizacao.js';

/** Todos os caminhos executáveis de um comando: `/x`, `/x sub`, `/x grupo sub`. */
export function rotasDoComando(command, localidade) {
  const json = command.data.toJSON();
  const rotas = [];
  const nomeComando = localidade ? nomeLocalizado(json, localidade) : json.name;

  for (const option of json.options ?? []) {
    if (option.type === 1) {
      const nomeOpcao = localidade ? nomeLocalizado(option, localidade) : option.name;
      rotas.push(`/${nomeComando} ${nomeOpcao}`);
      continue;
    }

    if (option.type === 2) {
      for (const sub of option.options ?? []) {
        if (sub.type === 1) {
          const nomeGrupo = localidade ? nomeLocalizado(option, localidade) : option.name;
          const nomeSub = localidade ? nomeLocalizado(sub, localidade) : sub.name;
          rotas.push(`/${nomeComando} ${nomeGrupo} ${nomeSub}`);
        }
      }
    }
  }

  // Comando sem subcomando é ele mesmo uma rota.
  return rotas.length > 0 ? rotas : [`/${nomeComando}`];
}

/** Quantas rotas executáveis existem numa coleção de comandos. */
export function contarRotas(commands) {
  let total = 0;
  for (const command of commands.values()) total += rotasDoComando(command).length;
  return total;
}
