import { ShardClientUtil } from 'discord.js';

/**
 * Utilidades de sharding.
 *
 * Regra de ouro: um servidor pertence sempre ao mesmo shard, calculado pelo
 * Discord como `(guild_id >> 22) % total_shards`. Tudo que roda em laço no bot
 * (agendador, contadores) precisa respeitar isso, senão cada shard repetiria o
 * mesmo trabalho.
 *
 * Todas as funções aqui funcionam também sem sharding (`client.shard === null`),
 * devolvendo o comportamento de processo único.
 */

/** Informações do shard atual, com valores neutros quando não há sharding. */
export function shardInfo(client) {
  return {
    sharded: Boolean(client.shard),
    ids: client.shard?.ids ?? [0],
    count: client.shard?.count ?? 1,
  };
}

/** Rótulo curto para logs: "shard 2/8" ou "processo único". */
export function shardLabel(client) {
  const { sharded, ids, count } = shardInfo(client);
  return sharded ? `shard ${ids.join(',')}/${count}` : 'processo único';
}

/**
 * Diz se ESTE shard é responsável por um servidor.
 *
 * `guildId` nulo (lembrete criado em DM, por exemplo) fica com o shard 0, para
 * que exatamente um processo cuide dele.
 */
export function ownsGuild(client, guildId) {
  const { sharded, ids, count } = shardInfo(client);
  if (!sharded) return true;
  if (!guildId) return ids.includes(0);

  return ids.includes(ShardClientUtil.shardIdForGuildId(guildId, count));
}

/**
 * Soma um valor numérico entre todos os shards.
 *
 * Durante a inicialização os outros shards ainda podem não estar prontos e o
 * `broadcastEval` rejeita; nesse caso devolvemos o valor local, que é melhor do
 * que quebrar o comando.
 */
export async function sumAcrossShards(client, evaluate, localValue) {
  if (!client.shard) return { total: localValue, partial: false };

  try {
    const results = await client.shard.broadcastEval(evaluate);
    return {
      total: results.reduce((sum, value) => sum + (Number(value) || 0), 0),
      partial: false,
    };
  } catch {
    // Algum shard ainda não respondeu: informamos que o número é parcial.
    return { total: localValue, partial: true };
  }
}

/** Total de servidores somando todos os shards. */
export function totalGuilds(client) {
  return sumAcrossShards(
    client,
    (instance) => instance.guilds.cache.size,
    client.guilds.cache.size,
  );
}

/** Total de membros alcançados somando todos os shards. */
export function totalMembers(client) {
  const local = client.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0);
  return sumAcrossShards(
    client,
    (instance) => instance.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0),
    local,
  );
}
