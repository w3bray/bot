import { ActivityType, Events } from 'discord.js';
import { logger } from '../lib/logger.js';
import { discoverOwners } from '../lib/owner.js';
import { shardLabel, totalGuilds } from '../lib/shard.js';
import { maybeDeployCommands } from '../services/autodeploy.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.info(`Conectado como ${client.user.tag} (${shardLabel(client)})`);
    logger.info(`Este processo atende ${client.guilds.cache.size} servidor(es).`);

    await discoverOwners(client);
    await maybeDeployCommands(client);

    const updatePresence = async () => {
      // Mostra o total de todos os shards; se algum ainda não respondeu, cai
      // para a contagem local em vez de deixar a presença sem atualizar.
      const { total } = await totalGuilds(client);

      client.user.setPresence({
        status: 'online',
        activities: [
          {
            name: `/ajuda · ${total} servidores`,
            type: ActivityType.Watching,
          },
        ],
      });
    };

    await updatePresence().catch((error) =>
      logger.debug('Não consegui definir a presença:', error.message),
    );

    setInterval(() => {
      updatePresence().catch(() => null);
    }, 600_000).unref();
  },
};
