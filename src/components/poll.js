import { MessageFlags } from 'discord.js';
import { db, readJson } from '../lib/db.js';
import { embed } from '../lib/embeds.js';
import { OPTION_EMOJIS, getPoll, pollEmbed } from '../services/polls.js';

const selectVote = db.prepare(
  'SELECT 1 FROM poll_votes WHERE message_id = ? AND user_id = ? AND choice = ?',
);
const deleteVote = db.prepare(
  'DELETE FROM poll_votes WHERE message_id = ? AND user_id = ? AND choice = ?',
);
const deleteAllVotes = db.prepare(
  'DELETE FROM poll_votes WHERE message_id = ? AND user_id = ?',
);
const insertVote = db.prepare(
  'INSERT OR IGNORE INTO poll_votes (message_id, user_id, choice) VALUES (?, ?, ?)',
);

export default {
  id: 'poll',

  async execute(interaction, { action, args }) {
    if (action !== 'vote') return;

    const [messageId, rawChoice] = args;
    const choice = Number(rawChoice);
    const poll = getPoll(messageId ?? interaction.message.id);

    if (!poll) {
      return interaction.reply({
        embeds: [embed.error('Esta enquete não existe mais.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (poll.ended) {
      return interaction.reply({
        embeds: [embed.warning('Esta enquete já foi encerrada.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const options = readJson(poll.options, []);
    const label = options[choice];
    if (label === undefined) {
      return interaction.reply({
        embeds: [embed.error('Essa opção não existe.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const hadVote = selectVote.get(poll.message_id, interaction.user.id, choice);
    let feedback;

    if (hadVote) {
      deleteVote.run(poll.message_id, interaction.user.id, choice);
      feedback = `Voto removido de ${OPTION_EMOJIS[choice]} **${label}**.`;
    } else {
      // Escolha única: o voto anterior é substituído.
      if (!poll.multi) deleteAllVotes.run(poll.message_id, interaction.user.id);
      insertVote.run(poll.message_id, interaction.user.id, choice);
      feedback = `Voto registrado em ${OPTION_EMOJIS[choice]} **${label}**.`;
    }

    await interaction.update({ embeds: [pollEmbed(poll)] }).catch(() => null);

    await interaction.followUp({
      embeds: [embed.success(feedback)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
