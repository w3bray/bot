import { Events } from 'discord.js';
import { sync } from '../services/starboard.js';

export default {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    if (user.bot) return;
    if (reaction.partial) {
      const fetched = await reaction.fetch().catch(() => null);
      if (!fetched) return;
    }
    await sync(reaction);
  },
};
