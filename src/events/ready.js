import { ActivityType, Events } from 'discord.js';
import { logger } from '../lib/logger.js';

export default {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(`Conectado como ${client.user.tag}`);
    logger.info(
      `Servindo ${client.guilds.cache.size} servidor(es) e ${client.users.cache.size} usuário(s) em cache.`,
    );

    const updatePresence = () => {
      client.user.setPresence({
        status: 'online',
        activities: [
          {
            name: `/ajuda · ${client.guilds.cache.size} servidores`,
            type: ActivityType.Watching,
          },
        ],
      });
    };

    updatePresence();
    setInterval(updatePresence, 600_000).unref();
  },
};
