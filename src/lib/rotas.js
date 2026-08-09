/**
 * Uma "rota" é um caminho que a pessoa consegue digitar e executar.
 *
 * `client.commands.size` conta os comandos de topo — hoje 100, o teto do
 * Discord. Mas cada família guarda até 25 subcomandos, e é a soma deles que
 * responde "quantos comandos o bot tem". Contar errado aqui produz mensagens
 * que se contradizem entre `/ajuda` e a apresentação em servidor novo.
 */

/** Todos os caminhos executáveis de um comando: `/x`, `/x sub`, `/x grupo sub`. */
export function rotasDoComando(command) {
  const json = command.data.toJSON();
  const rotas = [];

  for (const option of json.options ?? []) {
    if (option.type === 1) {
      rotas.push(`/${json.name} ${option.name}`);
      continue;
    }

    if (option.type === 2) {
      for (const sub of option.options ?? []) {
        if (sub.type === 1) rotas.push(`/${json.name} ${option.name} ${sub.name}`);
      }
    }
  }

  // Comando sem subcomando é ele mesmo uma rota.
  return rotas.length > 0 ? rotas : [`/${json.name}`];
}

/** Quantas rotas executáveis existem numa coleção de comandos. */
export function contarRotas(commands) {
  let total = 0;
  for (const command of commands.values()) total += rotasDoComando(command).length;
  return total;
}
