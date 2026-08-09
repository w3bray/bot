import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { colors } from '../../config.js';
import { embed, truncate } from '../../lib/embeds.js';
import { aviso, bloco, familia, opt } from '../../lib/familia.js';
import { checkHierarchy } from '../../lib/permissions.js';

const NOMES = {
  [PermissionFlagsBits.ManageMessages]: 'Gerenciar Mensagens',
  [PermissionFlagsBits.ManageChannels]: 'Gerenciar Canais',
  [PermissionFlagsBits.ManageRoles]: 'Gerenciar Cargos',
  [PermissionFlagsBits.ManageNicknames]: 'Gerenciar Apelidos',
  [PermissionFlagsBits.ModerateMembers]: 'Moderar Membros',
  [PermissionFlagsBits.KickMembers]: 'Expulsar Membros',
  [PermissionFlagsBits.BanMembers]: 'Banir Membros',
  [PermissionFlagsBits.ManageGuild]: 'Gerenciar Servidor',
};

/** Exige a permissão de quem chamou E do bot: faltando qualquer uma, para aqui. */
function exigir(interaction, flag) {
  if (!interaction.member.permissions.has(flag)) {
    throw aviso(`Você precisa da permissão **${NOMES[flag]}** para isso.`);
  }
  if (!interaction.guild.members.me.permissions.has(flag)) {
    throw aviso(`Eu preciso da permissão **${NOMES[flag]}** para isso. Peça a um administrador.`);
  }
}

const alvoValido = (interaction, membro) => {
  const erro = checkHierarchy(interaction.member, membro, interaction.guild.members.me);
  if (erro) throw aviso(erro);
};

const MEMBRO = opt.usuario('membro', 'O membro', true);
const MOTIVO = opt.texto('motivo', 'O motivo', false, { max: 400 });
const CANAL = opt.canal('canal', 'O canal (padrão: este)', false);

const textoOuVoz = (canal) => {
  if (canal && ![ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice].includes(canal.type)) {
    throw aviso('Escolha um canal de texto ou de voz.');
  }
};

export default familia({
  name: 'mod',
  description: 'Ferramentas de moderação: limpeza, trancar canais, cargos em massa e auditoria.',
  cooldown: 4,
  dm: false,
  subs: [
    {
      name: 'trancar',
      description: 'Impede que os membros falem no canal.',
      options: [CANAL, MOTIVO],
      run: async ({ canal, motivo }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageChannels);
        const alvo = canal ?? interaction.channel;
        textoOuVoz(alvo);
        await alvo.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }, {
          reason: `${interaction.user.tag}: ${motivo ?? 'sem motivo'}`,
        });
        return `🔒 **${alvo}** trancado.${motivo ? `\nMotivo: ${motivo}` : ''}`;
      },
    },
    {
      name: 'destrancar',
      description: 'Libera a fala no canal de novo.',
      options: [CANAL],
      run: async ({ canal }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageChannels);
        const alvo = canal ?? interaction.channel;
        textoOuVoz(alvo);
        await alvo.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
        return `🔓 **${alvo}** destrancado.`;
      },
    },
    {
      name: 'trancar-tudo',
      description: 'Tranca todos os canais de texto de uma vez.',
      options: [MOTIVO],
      run: async ({ motivo }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageChannels);
        await interaction.deferReply();
        const canais = interaction.guild.channels.cache.filter((c) => c.type === ChannelType.GuildText);
        let feitos = 0;
        for (const canal of canais.values()) {
          const ok = await canal.permissionOverwrites
            .edit(interaction.guild.roles.everyone, { SendMessages: false })
            .then(() => true)
            .catch(() => false);
          if (ok) feitos += 1;
        }
        await interaction.editReply({
          embeds: [embed.warning(`🔒 Tranquei **${feitos}** de ${canais.size} canais.${motivo ? `\nMotivo: ${motivo}` : ''}`)],
        });
        return null;
      },
    },
    {
      name: 'destrancar-tudo',
      description: 'Destranca todos os canais de texto.',
      run: async (_, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageChannels);
        await interaction.deferReply();
        const canais = interaction.guild.channels.cache.filter((c) => c.type === ChannelType.GuildText);
        let feitos = 0;
        for (const canal of canais.values()) {
          const ok = await canal.permissionOverwrites
            .edit(interaction.guild.roles.everyone, { SendMessages: null })
            .then(() => true)
            .catch(() => false);
          if (ok) feitos += 1;
        }
        await interaction.editReply({ embeds: [embed.success(`🔓 Destranquei **${feitos}** canais.`)] });
        return null;
      },
    },
    {
      name: 'lento',
      description: 'Define o modo lento do canal.',
      options: [opt.inteiro('segundos', 'De 0 (desliga) a 21600', true, { min: 0, max: 21600 }), CANAL],
      run: async ({ segundos, canal }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageChannels);
        const alvo = canal ?? interaction.channel;
        await alvo.setRateLimitPerUser(segundos);
        return segundos === 0
          ? `⏱️ Modo lento desligado em **${alvo}**.`
          : `⏱️ Modo lento de **${segundos}s** em **${alvo}**.`;
      },
    },
    {
      name: 'limpar-de',
      description: 'Apaga as mensagens recentes de um membro.',
      options: [MEMBRO, opt.inteiro('quantidade', 'Quantas procurar (até 100)', true, { min: 1, max: 100 })],
      run: async ({ membro, quantidade }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageMessages);
        await interaction.deferReply({ flags: 64 });
        const mensagens = await interaction.channel.messages.fetch({ limit: 100 });
        const doAlvo = [...mensagens.filter((m) => m.author.id === membro.id).values()].slice(0, quantidade);
        const apagadas = await interaction.channel.bulkDelete(doAlvo, true).catch(() => null);
        await interaction.editReply({
          embeds: [
            apagadas
              ? embed.success(`🧹 Apaguei **${apagadas.size}** mensagens de ${membro}.`)
              : embed.error('Não consegui apagar. Mensagens com mais de 14 dias não podem ser removidas em massa.'),
          ],
        });
        return null;
      },
    },
    {
      name: 'limpar-bots',
      description: 'Apaga as mensagens de bots no canal.',
      options: [opt.inteiro('quantidade', 'Quantas procurar (até 100)', true, { min: 1, max: 100 })],
      run: async ({ quantidade }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageMessages);
        await interaction.deferReply({ flags: 64 });
        const mensagens = await interaction.channel.messages.fetch({ limit: quantidade });
        const deBots = [...mensagens.filter((m) => m.author.bot).values()];
        const apagadas = await interaction.channel.bulkDelete(deBots, true).catch(() => null);
        await interaction.editReply({
          embeds: [embed.success(`🤖 Apaguei **${apagadas?.size ?? 0}** mensagens de bots.`)],
        });
        return null;
      },
    },
    {
      name: 'limpar-links',
      description: 'Apaga as mensagens que contêm links.',
      options: [opt.inteiro('quantidade', 'Quantas procurar (até 100)', true, { min: 1, max: 100 })],
      run: async ({ quantidade }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageMessages);
        await interaction.deferReply({ flags: 64 });
        const mensagens = await interaction.channel.messages.fetch({ limit: quantidade });
        const comLink = [...mensagens.filter((m) => /https?:\/\//i.test(m.content)).values()];
        const apagadas = await interaction.channel.bulkDelete(comLink, true).catch(() => null);
        await interaction.editReply({
          embeds: [embed.success(`🔗 Apaguei **${apagadas?.size ?? 0}** mensagens com link.`)],
        });
        return null;
      },
    },
    {
      name: 'limpar-anexos',
      description: 'Apaga as mensagens com imagens ou arquivos.',
      options: [opt.inteiro('quantidade', 'Quantas procurar (até 100)', true, { min: 1, max: 100 })],
      run: async ({ quantidade }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageMessages);
        await interaction.deferReply({ flags: 64 });
        const mensagens = await interaction.channel.messages.fetch({ limit: quantidade });
        const comAnexo = [...mensagens.filter((m) => m.attachments.size > 0).values()];
        const apagadas = await interaction.channel.bulkDelete(comAnexo, true).catch(() => null);
        await interaction.editReply({
          embeds: [embed.success(`📎 Apaguei **${apagadas?.size ?? 0}** mensagens com anexo.`)],
        });
        return null;
      },
    },
    {
      name: 'limpar-contendo',
      description: 'Apaga as mensagens que contêm um texto.',
      options: [
        opt.texto('trecho', 'O texto a procurar', true, { max: 100 }),
        opt.inteiro('quantidade', 'Quantas procurar (até 100)', true, { min: 1, max: 100 }),
      ],
      run: async ({ trecho, quantidade }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageMessages);
        await interaction.deferReply({ flags: 64 });
        const mensagens = await interaction.channel.messages.fetch({ limit: quantidade });
        const alvo = trecho.toLowerCase();
        const casadas = [...mensagens.filter((m) => m.content.toLowerCase().includes(alvo)).values()];
        const apagadas = await interaction.channel.bulkDelete(casadas, true).catch(() => null);
        await interaction.editReply({
          embeds: [embed.success(`🧹 Apaguei **${apagadas?.size ?? 0}** mensagens contendo \`${trecho}\`.`)],
        });
        return null;
      },
    },
    {
      name: 'cargo-dar',
      description: 'Dá um cargo a um membro.',
      options: [MEMBRO, opt.cargo('cargo', 'O cargo', true)],
      run: async ({ membro, cargo }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageRoles);
        const alvo = await interaction.guild.members.fetch(membro.id);
        if (cargo.position >= interaction.guild.members.me.roles.highest.position) {
          throw aviso('Esse cargo está acima do meu — mova o meu para cima na lista.');
        }
        if (alvo.roles.cache.has(cargo.id)) throw aviso(`${alvo} já tem o cargo ${cargo}.`);
        await alvo.roles.add(cargo, `por ${interaction.user.tag}`);
        return `✅ Dei o cargo ${cargo} para ${alvo}.`;
      },
    },
    {
      name: 'cargo-tirar',
      description: 'Tira um cargo de um membro.',
      options: [MEMBRO, opt.cargo('cargo', 'O cargo', true)],
      run: async ({ membro, cargo }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageRoles);
        const alvo = await interaction.guild.members.fetch(membro.id);
        if (cargo.position >= interaction.guild.members.me.roles.highest.position) {
          throw aviso('Esse cargo está acima do meu — mova o meu para cima na lista.');
        }
        if (!alvo.roles.cache.has(cargo.id)) throw aviso(`${alvo} não tem o cargo ${cargo}.`);
        await alvo.roles.remove(cargo, `por ${interaction.user.tag}`);
        return `✅ Tirei o cargo ${cargo} de ${alvo}.`;
      },
    },
    {
      name: 'cargo-todos',
      description: 'Dá um cargo a todos os membros humanos.',
      options: [opt.cargo('cargo', 'O cargo', true)],
      run: async ({ cargo }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageRoles);
        if (cargo.position >= interaction.guild.members.me.roles.highest.position) {
          throw aviso('Esse cargo está acima do meu — mova o meu para cima na lista.');
        }
        await interaction.deferReply();
        const todos = await interaction.guild.members.fetch();
        const faltando = [...todos.filter((m) => !m.user.bot && !m.roles.cache.has(cargo.id)).values()];
        if (faltando.length > 200) throw aviso('São mais de 200 membros — o Discord limitaria a operação.');

        let feitos = 0;
        for (const membro of faltando) {
          const ok = await membro.roles.add(cargo).then(() => true).catch(() => false);
          if (ok) feitos += 1;
        }
        await interaction.editReply({
          embeds: [embed.success(`✅ Dei ${cargo} para **${feitos}** de ${faltando.length} membros.`)],
        });
        return null;
      },
    },
    {
      name: 'cargo-limpar',
      description: 'Tira um cargo de todo mundo que o tem.',
      options: [opt.cargo('cargo', 'O cargo', true)],
      run: async ({ cargo }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageRoles);
        if (cargo.position >= interaction.guild.members.me.roles.highest.position) {
          throw aviso('Esse cargo está acima do meu — mova o meu para cima na lista.');
        }
        await interaction.deferReply();
        const comCargo = [...cargo.members.values()];
        let feitos = 0;
        for (const membro of comCargo) {
          const ok = await membro.roles.remove(cargo).then(() => true).catch(() => false);
          if (ok) feitos += 1;
        }
        await interaction.editReply({
          embeds: [embed.success(`✅ Tirei ${cargo} de **${feitos}** membros.`)],
        });
        return null;
      },
    },
    {
      name: 'apelido-limpar',
      description: 'Remove o apelido de um membro.',
      options: [MEMBRO],
      run: async ({ membro }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageNicknames);
        const alvo = await interaction.guild.members.fetch(membro.id);
        alvoValido(interaction, alvo);
        await alvo.setNickname(null, `por ${interaction.user.tag}`);
        return `✅ Apelido de ${alvo} removido.`;
      },
    },
    {
      name: 'silenciar',
      description: 'Silencia (castigo) por um tempo.',
      options: [
        MEMBRO,
        opt.inteiro('minutos', 'De 1 a 40320 (28 dias)', true, { min: 1, max: 40320 }),
        MOTIVO,
      ],
      run: async ({ membro, minutos, motivo }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ModerateMembers);
        const alvo = await interaction.guild.members.fetch(membro.id);
        alvoValido(interaction, alvo);
        await alvo.timeout(minutos * 60_000, motivo ?? `por ${interaction.user.tag}`);
        const fim = Math.floor((Date.now() + minutos * 60_000) / 1000);
        return `🔇 ${alvo} silenciado até <t:${fim}:t> (<t:${fim}:R>).${motivo ? `\nMotivo: ${motivo}` : ''}`;
      },
    },
    {
      name: 'dessilenciar',
      description: 'Tira o castigo de um membro.',
      options: [MEMBRO],
      run: async ({ membro }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ModerateMembers);
        const alvo = await interaction.guild.members.fetch(membro.id);
        if (!alvo.isCommunicationDisabled()) throw aviso(`${alvo} não está silenciado.`);
        await alvo.timeout(null, `por ${interaction.user.tag}`);
        return `🔊 ${alvo} pode falar de novo.`;
      },
    },
    {
      name: 'silenciados',
      description: 'Lista quem está de castigo agora.',
      run: async (_, interaction) => {
        const todos = await interaction.guild.members.fetch();
        const calados = [...todos.filter((m) => m.isCommunicationDisabled()).values()];
        return {
          embeds: [
            embed.base(colors.warning)
              .setTitle(`Silenciados (${calados.length})`)
              .setDescription(
                calados
                  .map((m) => `${m} — até <t:${Math.floor(m.communicationDisabledUntilTimestamp / 1000)}:R>`)
                  .join('\n') || '_Ninguém está de castigo._',
              ),
          ],
        };
      },
    },
    {
      name: 'avisar-canal',
      description: 'Publica um aviso destacado no canal.',
      options: [opt.texto('mensagem', 'O aviso', true, { max: 2000 }), CANAL],
      run: async ({ mensagem, canal }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageMessages);
        const alvo = canal ?? interaction.channel;
        await alvo.send({
          embeds: [
            embed.base(colors.warning)
              .setTitle('⚠️ Aviso da moderação')
              .setDescription(mensagem)
              .setFooter({ text: `por ${interaction.user.tag}` })
              .setTimestamp(),
          ],
        });
        return { embeds: [embed.success(`Aviso publicado em ${alvo}.`)], flags: 64 };
      },
    },
    {
      name: 'quem-e',
      description: 'Ficha rápida de um membro para moderação.',
      options: [MEMBRO],
      run: async ({ membro }, interaction) => {
        const alvo = await interaction.guild.members.fetch(membro.id).catch(() => null);
        if (!alvo) throw aviso('Esse usuário não está no servidor.');
        const idadeConta = Math.floor((Date.now() - alvo.user.createdTimestamp) / 86_400_000);
        const suspeita = idadeConta < 7;
        return {
          embeds: [
            embed.base(suspeita ? colors.warning : colors.primary)
              .setTitle(alvo.user.tag)
              .setThumbnail(alvo.displayAvatarURL({ size: 256 }))
              .addFields(
                { name: 'ID', value: `\`${alvo.id}\``, inline: true },
                { name: 'Conta criada', value: `<t:${Math.floor(alvo.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: 'Entrou aqui', value: alvo.joinedTimestamp ? `<t:${Math.floor(alvo.joinedTimestamp / 1000)}:R>` : '—', inline: true },
                { name: 'Cargo mais alto', value: `${alvo.roles.highest}`, inline: true },
                { name: 'Castigo', value: alvo.isCommunicationDisabled() ? `até <t:${Math.floor(alvo.communicationDisabledUntilTimestamp / 1000)}:R>` : 'não', inline: true },
                { name: 'Impulsiona', value: alvo.premiumSince ? 'sim' : 'não', inline: true },
              )
              .setFooter(suspeita ? { text: '⚠️ Conta criada há menos de 7 dias' } : null),
          ],
        };
      },
    },
    {
      name: 'contas-novas',
      description: 'Lista membros com conta recém-criada.',
      options: [opt.inteiro('dias', 'Contas criadas nos últimos N dias', true, { min: 1, max: 90 })],
      run: async ({ dias }, interaction) => {
        const todos = await interaction.guild.members.fetch();
        const limite = Date.now() - dias * 86_400_000;
        const novas = [...todos.filter((m) => m.user.createdTimestamp > limite).values()]
          .sort((a, b) => b.user.createdTimestamp - a.user.createdTimestamp);
        return {
          embeds: [
            embed.base(novas.length > 0 ? colors.warning : colors.success)
              .setTitle(`Contas criadas nos últimos ${dias} dias (${novas.length})`)
              .setDescription(
                truncate(
                  novas.slice(0, 30)
                    .map((m) => `${m} — <t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`)
                    .join('\n') || '_Nenhuma._',
                  4000,
                ),
              ),
          ],
        };
      },
    },
    {
      name: 'sem-avatar',
      description: 'Lista membros sem foto de perfil.',
      run: async (_, interaction) => {
        const todos = await interaction.guild.members.fetch();
        const sem = [...todos.filter((m) => !m.user.avatar && !m.user.bot).values()];
        return {
          embeds: [
            embed.base(colors.neutral)
              .setTitle(`Sem foto de perfil (${sem.length})`)
              .setDescription(truncate(sem.slice(0, 50).map((m) => `${m}`).join(' · ') || '_Nenhum._', 4000)),
          ],
        };
      },
    },
    {
      name: 'inativos',
      description: 'Estima quantos membros seriam removidos por inatividade.',
      options: [opt.inteiro('dias', 'Sem entrar há N dias (1, 7 ou 30)', true, { min: 1, max: 30 })],
      run: async ({ dias }, interaction) => {
        exigir(interaction, PermissionFlagsBits.KickMembers);
        const quantos = await interaction.guild.members.prune({ dry: true, days: dias }).catch(() => null);
        if (quantos === null) throw aviso('Não consegui estimar — confira minhas permissões.');
        return `Removendo quem não aparece há **${dias}** dias, sairiam **${quantos}** membros.\n\n_Isto é só uma estimativa: nada foi removido._`;
      },
    },
    {
      name: 'exportar-membros',
      description: 'Gera a lista de membros em texto.',
      options: [opt.cargo('cargo', 'Filtrar por cargo', false)],
      run: async ({ cargo }, interaction) => {
        exigir(interaction, PermissionFlagsBits.ManageGuild);
        const todos = await interaction.guild.members.fetch();
        const filtrados = [...todos.filter((m) => !cargo || m.roles.cache.has(cargo.id)).values()];
        const linhas = filtrados.slice(0, 120).map((m) => `${m.user.tag}\t${m.id}`);
        return `**${filtrados.length}** membro(s)${cargo ? ` com ${cargo}` : ''}${filtrados.length > 120 ? ' (mostrando os 120 primeiros)' : ''}\n${bloco(linhas.join('\n'))}`;
      },
    },
  ],
});
