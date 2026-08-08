import { MessageFlags } from 'discord.js';
import { db } from '../lib/db.js';
import { embed } from '../lib/embeds.js';
import { voteRow } from '../commands/utilidades/sugestao.js';

const selectSuggestion = db.prepare('SELECT * FROM suggestions WHERE message_id = ?');
const selectVote = db.prepare(
  'SELECT vote FROM suggestion_votes WHERE message_id = ? AND user_id = ?',
);
const countVotes = db.prepare(
  'SELECT SUM(vote = 1) AS up, SUM(vote = -1) AS down FROM suggestion_votes WHERE message_id = ?',
);

export default {
  id: 'suggestion',

  async execute(interaction, { action, args }) {
    const messageId = args[0] ?? interaction.message.id;
    const suggestion = selectSuggestion.get(messageId);

    if (!suggestion) {
      return interaction.reply({
        embeds: [embed.error('Essa sugestão não existe mais.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (suggestion.status !== 'pendente') {
      return interaction.reply({
        embeds: [embed.warning('Essa sugestão já foi decidida — a votação está encerrada.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const vote = action === 'up' ? 1 : -1;
    const existing = selectVote.get(messageId, interaction.user.id);

    let feedback;
    if (existing?.vote === vote) {
      // Clicar de novo no mesmo botão retira o voto.
      db.prepare('DELETE FROM suggestion_votes WHERE message_id = ? AND user_id = ?').run(
        messageId,
        interaction.user.id,
      );
      feedback = 'Seu voto foi removido.';
    } else {
      db.prepare(
        `INSERT INTO suggestion_votes (message_id, user_id, vote) VALUES (?, ?, ?)
         ON CONFLICT (message_id, user_id) DO UPDATE SET vote = excluded.vote`,
      ).run(messageId, interaction.user.id, vote);
      feedback = vote === 1 ? 'Você votou a favor. 👍' : 'Você votou contra. 👎';
    }

    const votes = countVotes.get(messageId);

    await interaction
      .update({ components: [voteRow(messageId, votes.up ?? 0, votes.down ?? 0)] })
      .catch(() => null);

    await interaction.followUp({
      embeds: [embed.success(feedback)],
      flags: MessageFlags.Ephemeral,
    });
  },
};
