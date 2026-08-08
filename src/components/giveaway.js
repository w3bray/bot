import { MessageFlags } from 'discord.js';
import { db } from '../lib/db.js';
import { embed } from '../lib/embeds.js';
import { giveawayEmbed } from '../services/giveaways.js';

const selectGiveaway = db.prepare('SELECT * FROM giveaways WHERE message_id = ?');
const selectEntry = db.prepare(
  'SELECT 1 FROM giveaway_entries WHERE message_id = ? AND user_id = ?',
);
const insertEntry = db.prepare(
  'INSERT OR IGNORE INTO giveaway_entries (message_id, user_id) VALUES (?, ?)',
);
const deleteEntry = db.prepare(
  'DELETE FROM giveaway_entries WHERE message_id = ? AND user_id = ?',
);
const countEntries = db.prepare(
  'SELECT COUNT(*) AS total FROM giveaway_entries WHERE message_id = ?',
);

export default {
  id: 'giveaway',

  async execute(interaction, { action, args }) {
    if (action !== 'enter') return;

    const messageId = args[0] ?? interaction.message.id;
    const giveaway = selectGiveaway.get(messageId);

    if (!giveaway) {
      return interaction.reply({
        embeds: [embed.error('Este sorteio não existe mais.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (giveaway.ended || giveaway.ends_at <= Date.now()) {
      return interaction.reply({
        embeds: [embed.warning('Este sorteio já foi encerrado.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (giveaway.required_role && !interaction.member.roles.cache.has(giveaway.required_role)) {
      return interaction.reply({
        embeds: [
          embed.error(`Você precisa do cargo <@&${giveaway.required_role}> para participar.`),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Clicar de novo cancela a participação.
    const alreadyIn = selectEntry.get(messageId, interaction.user.id);
    if (alreadyIn) deleteEntry.run(messageId, interaction.user.id);
    else insertEntry.run(messageId, interaction.user.id);

    const total = countEntries.get(messageId).total;

    await interaction.update({ embeds: [giveawayEmbed(giveaway, total)] }).catch(() => null);

    await interaction.followUp({
      embeds: [
        alreadyIn
          ? embed.warning('Você saiu do sorteio. Clique de novo para voltar.')
          : embed.success('Participação confirmada! Boa sorte. 🍀'),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
