import { AttachmentBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { formatDuration } from '../../lib/time.js';
import {
  MAX_DURATION_SECONDS,
  download,
  isEnabled,
  probe,
  splitForUpload,
  uploadLimitFor,
  validateUrl,
} from '../../services/downloader.js';

// Uma parte por mensagem mantém cada requisição abaixo do teto HTTP do Discord.
const MAX_ATTACHMENTS_PER_MESSAGE = 1;

export default {
  cooldown: 30,
  data: new SlashCommandBuilder()
    .setName('baixar')
    .setDescription('Baixa um vídeo a partir do link e envia aqui no canal.')
    .addStringOption((option) =>
      option
        .setName('link')
        .setDescription('Link do vídeo (TikTok, YouTube, Instagram, X, Twitch, Reddit…)')
        .setRequired(true)
        .setMaxLength(500),
    )
    .addBooleanOption((option) =>
      option.setName('audio').setDescription('Baixar somente o áudio, em MP3'),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!isEnabled) {
      return replyError(
        interaction,
        'O download de vídeos não está disponível: o `yt-dlp` não está instalado no servidor do bot.',
      );
    }

    let url;
    try {
      url = validateUrl(interaction.options.getString('link'));
    } catch (error) {
      return replyError(interaction, error.message);
    }

    const audioOnly = interaction.options.getBoolean('audio') ?? false;
    const maxBytes = uploadLimitFor(interaction);

    await interaction.deferReply();

    // 1) Metadados primeiro: rejeita lives e vídeos longos antes de gastar banda.
    let info;
    try {
      info = await probe(url);
    } catch (error) {
      return interaction.editReply({ embeds: [embed.error(error.message)] });
    }

    if (info.isLive) {
      return interaction.editReply({
        embeds: [embed.error('Não dá para baixar uma transmissão ao vivo.')],
      });
    }

    if (info.duration && info.duration > MAX_DURATION_SECONDS) {
      return interaction.editReply({
        embeds: [
          embed.error(
            `Esse vídeo tem ${formatDuration(info.duration * 1000)} e o limite é ${formatDuration(MAX_DURATION_SECONDS * 1000)}.`,
          ),
        ],
      });
    }

    await interaction.editReply({
      embeds: [
        embed.info(`Baixando **${info.title}**… isso pode levar alguns segundos.`),
      ],
    });

    // 2) Download propriamente dito.
    let result;
    try {
      // O download não usa o teto do Discord. Se o arquivo for maior, ele será
      // dividido em partes abaixo do limite obrigatório de cada anexo.
      result = await download(url, { audioOnly });
    } catch (error) {
      return interaction.editReply({
        embeds: [embed.error(error.message)],
      });
    }

    try {
      const extension = audioOnly ? 'mp3' : 'mp4';
      const baseName =
        info.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 60).trim() || 'video';

      if (result.size > maxBytes) {
        await interaction.editReply({
          embeds: [
            embed.info(
              `O arquivo tem ${(result.size / 1024 / 1024).toFixed(1)} MB. Dividindo em partes para enviar pelo Discord…`,
            ),
          ],
        });
      }

      const delivery = await splitForUpload(result.file, {
        maxBytes,
        duration: info.duration,
        audioOnly,
      });
      const totalParts = delivery.parts.length;

      const resultEmbed = embed
        .base(colors.success)
        .setTitle(info.title.slice(0, 250))
        .setURL(info.webpage)
        .addFields(
          { name: 'Fonte', value: info.extractor, inline: true },
          {
            name: 'Duração',
            value: info.duration ? formatDuration(info.duration * 1000) : 'desconhecida',
            inline: true,
          },
          {
            name: 'Tamanho total',
            value: `${(result.size / 1024 / 1024).toFixed(1)} MB`,
            inline: true,
          },
          ...(info.uploader ? [{ name: 'Autor', value: info.uploader, inline: true }] : []),
          ...(totalParts > 1
            ? [
                {
                  name: 'Entrega',
                  value: `${totalParts} partes de até ${(maxBytes / 1024 / 1024).toFixed(0)} MB cada.`,
                  inline: true,
                },
              ]
            : []),
          ...(!delivery.playable
            ? [
                {
                  name: 'Como remontar',
                  value:
                    `Baixe todas as partes e junte na ordem. No Linux/macOS: ` +
                    `\`cat "${baseName}.${extension}.part"* > "${baseName}.${extension}"\`.`,
                },
              ]
            : []),
        )
        .setFooter({
          text: 'Respeite os direitos autorais e os termos de uso da plataforma de origem.',
        });

      const attachmentFor = (file, index) => {
        if (totalParts === 1) {
          return new AttachmentBuilder(file, { name: `${baseName}.${extension}` });
        }

        const number = String(index + 1).padStart(Math.max(3, String(totalParts).length), '0');
        const name = delivery.playable
          ? `${baseName}-parte-${number}.${extension}`
          : `${baseName}.${extension}.part${number}`;
        return new AttachmentBuilder(file, { name });
      };

      const firstBatch = delivery.parts.slice(0, MAX_ATTACHMENTS_PER_MESSAGE);

      await interaction.editReply({
        embeds: [resultEmbed],
        files: firstBatch.map((file, index) => attachmentFor(file, index)),
      });

      for (
        let start = MAX_ATTACHMENTS_PER_MESSAGE;
        start < totalParts;
        start += MAX_ATTACHMENTS_PER_MESSAGE
      ) {
        const batch = delivery.parts.slice(start, start + MAX_ATTACHMENTS_PER_MESSAGE);
        await interaction.followUp({
          content: `Partes ${start + 1}–${start + batch.length} de ${totalParts}:`,
          files: batch.map((file, offset) => attachmentFor(file, start + offset)),
        });
      }
    } catch (error) {
      await interaction.editReply({
        embeds: [
          embed.error(
            'Baixei o arquivo, mas não consegui enviá-lo aqui. Verifique se tenho permissão para anexar arquivos e enviar mensagens.',
          ),
        ],
      });
      throw error;
    } finally {
      await result.cleanup();
    }
  },
};
