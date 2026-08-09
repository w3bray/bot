import path from 'node:path';
import { AttachmentBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { colors } from '../../config.js';
import { embed, replyError } from '../../lib/embeds.js';
import { formatDuration } from '../../lib/time.js';
import {
  DOWNLOAD_MODES,
  download,
  probe,
  splitForUpload,
  uploadLimitFor,
  validateUrl,
} from '../../services/downloader.js';

// Um anexo por mensagem respeita tanto o teto por arquivo quanto o teto total
// de cada requisição do Discord, inclusive em servidores com boost.
const MAX_ATTACHMENTS_PER_MESSAGE = 1;

const KIND_LABELS = {
  video: { singular: 'vídeo', plural: 'vídeos' },
  audio: { singular: 'áudio', plural: 'áudios' },
  image: { singular: 'imagem', plural: 'imagens' },
};

export default {
  cooldown: 30,
  data: new SlashCommandBuilder()
    .setName('baixar')
    .setDescription('Baixa vídeo, áudio e imagens na melhor qualidade disponível.')
    .addStringOption((option) =>
      option
        .setName('link')
        .setDescription('Link público da publicação, vídeo, faixa ou galeria')
        .setRequired(true)
        .setMaxLength(500),
    )
    .addStringOption((option) =>
      option
        .setName('tipo')
        .setDescription('O que baixar (o padrão é tudo)')
        .addChoices(
          { name: 'Tudo: vídeo + áudio + todas as imagens', value: DOWNLOAD_MODES.ALL },
          { name: 'Somente vídeo', value: DOWNLOAD_MODES.VIDEO },
          { name: 'Somente áudio', value: DOWNLOAD_MODES.AUDIO },
          { name: 'Somente imagens/carrossel', value: DOWNLOAD_MODES.IMAGES },
        ),
    )
    .addBooleanOption((option) =>
      option
        .setName('audio')
        .setDescription('Compatibilidade antiga: equivale a tipo Somente áudio'),
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    let url;
    try {
      url = validateUrl(interaction.options.getString('link'));
    } catch (error) {
      return replyError(interaction, error.message);
    }

    const legacyAudio = interaction.options.getBoolean('audio') ?? false;
    const mode = legacyAudio
      ? DOWNLOAD_MODES.AUDIO
      : (interaction.options.getString('tipo') ?? DOWNLOAD_MODES.ALL);
    const maxBytes = uploadLimitFor(interaction);

    await interaction.deferReply();

    let info;
    try {
      info = await probe(url, { mode });
    } catch (error) {
      return interaction.editReply({ embeds: [embed.error(error.message)] });
    }

    if (info.isLive) {
      return interaction.editReply({
        embeds: [embed.error('Não dá para fechar e enviar uma transmissão enquanto ela está ao vivo.')],
      });
    }

    await interaction.editReply({
      embeds: [
        embed.info(
          `Baixando **${info.title}** na maior qualidade disponível… ` +
            'vídeos grandes e carrosséis podem demorar.',
        ),
      ],
    });

    let result;
    try {
      result = await download(url, { mode });
    } catch (error) {
      return interaction.editReply({ embeds: [embed.error(error.message)] });
    }

    try {
      const baseName =
        info.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 48).trim() || 'midia';
      const oversized = result.assets.filter((asset) => asset.size > maxBytes).length;
      if (oversized > 0) {
        await interaction.editReply({
          embeds: [
            embed.info(
              `${oversized} arquivo(s) ultrapassam o teto de anexo do Discord. ` +
                'Dividindo apenas para transporte, sem reduzir qualidade…',
            ),
          ],
        });
      }

      const kindIndexes = { video: 0, audio: 0, image: 0 };
      const prepared = [];
      let hasBinaryParts = false;

      for (const asset of result.assets) {
        kindIndexes[asset.kind] += 1;
        const extension = path.extname(asset.file).slice(1).toLowerCase() || 'bin';
        const delivery = await splitForUpload(asset.file, {
          maxBytes,
          duration: asset.kind === 'image' ? null : info.duration,
          kind: asset.kind,
          extension,
        });
        hasBinaryParts ||= !delivery.playable;

        const kindCount = result.assets.filter((item) => item.kind === asset.kind).length;
        const suffix =
          result.assets.length === 1
            ? ''
            : `-${asset.kind}-${String(kindIndexes[asset.kind]).padStart(
                Math.max(2, String(kindCount).length),
                '0',
              )}`;
        const stem = `${baseName}${suffix}`;

        delivery.parts.forEach((file, partIndex) => {
          const number = String(partIndex + 1).padStart(
            Math.max(3, String(delivery.parts.length).length),
            '0',
          );
          const name =
            delivery.parts.length === 1
              ? `${stem}.${extension}`
              : delivery.playable
                ? `${stem}-parte-${number}.${extension}`
                : `${stem}.${extension}.part${number}`;
          prepared.push({
            file,
            name,
            kind: asset.kind,
            source: asset.source,
            assetIndex: kindIndexes[asset.kind],
            assetCount: kindCount,
            partIndex: partIndex + 1,
            partCount: delivery.parts.length,
          });
        });
      }

      const counts = Object.keys(KIND_LABELS)
        .map((kind) => ({
          kind,
          count: result.assets.filter((asset) => asset.kind === kind).length,
        }))
        .filter(({ count }) => count > 0);
      const countText = counts
        .map(({ kind, count }) => {
          const label = count === 1 ? KIND_LABELS[kind].singular : KIND_LABELS[kind].plural;
          return `${count} ${label}`;
        })
        .join(' · ');

      const resultEmbed = embed
        .base(colors.success)
        .setTitle(info.title.slice(0, 250))
        .setURL(info.webpage)
        .addFields(
          { name: 'Baixado', value: countText, inline: false },
          { name: 'Fonte', value: info.extractor, inline: true },
          ...(info.duration
            ? [
                {
                  name: 'Duração',
                  value: formatDuration(info.duration * 1000),
                  inline: true,
                },
              ]
            : []),
          {
            name: 'Tamanho original total',
            value: `${(result.size / 1024 / 1024).toFixed(1)} MB`,
            inline: true,
          },
          {
            name: 'Entrega',
            value:
              `${result.assets.length} arquivo(s) original(is) em ${prepared.length} anexo(s). ` +
              `Cada anexo respeita ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`,
          },
          ...(info.uploader ? [{ name: 'Autor', value: info.uploader, inline: true }] : []),
          ...(result.warnings.length > 0
            ? [
                {
                  name: 'Não disponível nessa publicação',
                  value: result.warnings.join('\n').slice(0, 1024),
                },
              ]
            : []),
          ...(hasBinaryParts
            ? [
                {
                  name: 'Partes sem perda',
                  value:
                    'Arquivos `.part001`, `.part002`… são pedaços binários do original. ' +
                    'Baixe todos e concatene na ordem para reconstruir o arquivo exato.',
                },
              ]
            : []),
        )
        .setFooter({
          text: 'A disponibilidade depende do acesso público e do que a plataforma entrega aos extratores.',
        });

      const attachmentFor = (item) => new AttachmentBuilder(item.file, { name: item.name });
      const firstBatch = prepared.slice(0, MAX_ATTACHMENTS_PER_MESSAGE);
      await interaction.editReply({
        embeds: [resultEmbed],
        files: firstBatch.map(attachmentFor),
      });

      for (
        let start = MAX_ATTACHMENTS_PER_MESSAGE;
        start < prepared.length;
        start += MAX_ATTACHMENTS_PER_MESSAGE
      ) {
        const batch = prepared.slice(start, start + MAX_ATTACHMENTS_PER_MESSAGE);
        const item = batch[0];
        const label = KIND_LABELS[item.kind].singular;
        const detail =
          item.partCount > 1
            ? `${label} ${item.assetIndex}/${item.assetCount} · parte ${item.partIndex}/${item.partCount}`
            : `${label} ${item.assetIndex}/${item.assetCount}`;
        await interaction.followUp({
          content: `Arquivo ${start + 1}/${prepared.length} · ${detail}:`,
          files: batch.map(attachmentFor),
        });
      }
    } catch (error) {
      await interaction.editReply({
        embeds: [
          embed.error(
            'Baixei a mídia, mas não consegui entregar todos os arquivos. ' +
              'Confira se o bot pode anexar arquivos e enviar mensagens neste canal.',
          ),
        ],
      });
      throw error;
    } finally {
      await result.cleanup();
    }
  },
};
