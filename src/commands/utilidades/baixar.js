import { AttachmentBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { formatDuration } from '../../lib/time.js';
import {
  MAX_DURATION_SECONDS,
  download,
  isEnabled,
  probe,
  uploadLimitFor,
  validateUrl,
} from '../../services/downloader.js';

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
    const maxBytes = uploadLimitFor(interaction.guild);

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
      result = await download(url, { maxBytes, audioOnly });
    } catch (error) {
      return interaction.editReply({
        embeds: [
          embed
            .error(error.message)
            .addFields({
              name: 'Dica',
              value: `Vídeos acima de ${Math.round(maxBytes / 1024 / 1024)} MB não cabem no upload deste servidor. Tente a opção \`audio: true\` ou um vídeo menor.`,
            }),
        ],
      });
    }

    try {
      const extension = audioOnly ? 'mp3' : 'mp4';
      const name = `${info.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 60).trim() || 'video'}.${extension}`;

      await interaction.editReply({
        embeds: [
          embed
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
                name: 'Tamanho',
                value: `${(result.size / 1024 / 1024).toFixed(1)} MB`,
                inline: true,
              },
              ...(info.uploader ? [{ name: 'Autor', value: info.uploader, inline: true }] : []),
            )
            .setFooter({
              text: 'Respeite os direitos autorais e os termos de uso da plataforma de origem.',
            }),
        ],
        files: [new AttachmentBuilder(result.file, { name })],
      });
    } catch (error) {
      await interaction.editReply({
        embeds: [
          embed.error(
            'Baixei o arquivo, mas não consegui enviá-lo aqui. Verifique se tenho permissão para anexar arquivos.',
          ),
        ],
      });
      throw error;
    } finally {
      await result.cleanup();
    }
  },
};
