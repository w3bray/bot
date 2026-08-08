import { PermissionFlagsBits } from 'discord.js';

/**
 * Verifica se `moderator` pode agir sobre `target` (hierarquia de cargos + dono).
 * Retorna null se estiver tudo certo, ou uma string com o motivo do bloqueio.
 */
export function checkHierarchy(moderator, target, me) {
  if (target.id === moderator.id) return 'Você não pode fazer isso com você mesmo.';
  if (target.id === me.id) return 'Não posso fazer isso comigo mesmo.';
  if (target.id === target.guild.ownerId) return 'Não é possível punir o dono do servidor.';

  if (
    moderator.id !== moderator.guild.ownerId &&
    target.roles.highest.position >= moderator.roles.highest.position
  ) {
    return 'O cargo mais alto desse membro é igual ou superior ao seu.';
  }

  if (target.roles.highest.position >= me.roles.highest.position) {
    return 'O cargo desse membro está acima do meu — mova meu cargo para cima na lista.';
  }

  return null;
}

/** Lista legível das permissões que faltam ao bot no canal/servidor. */
export function missingPermissions(guild, permissions, channel = null) {
  const me = guild.members.me;
  if (!me) return [];
  const resolved = channel ? channel.permissionsFor(me) : me.permissions;
  if (!resolved) return [];
  return permissions.filter((permission) => !resolved.has(permission)).map(permissionName);
}

const NAMES = {
  [PermissionFlagsBits.BanMembers]: 'Banir Membros',
  [PermissionFlagsBits.KickMembers]: 'Expulsar Membros',
  [PermissionFlagsBits.ModerateMembers]: 'Moderar Membros',
  [PermissionFlagsBits.ManageMessages]: 'Gerenciar Mensagens',
  [PermissionFlagsBits.ManageRoles]: 'Gerenciar Cargos',
  [PermissionFlagsBits.ManageChannels]: 'Gerenciar Canais',
  [PermissionFlagsBits.ManageNicknames]: 'Gerenciar Apelidos',
  [PermissionFlagsBits.ManageGuild]: 'Gerenciar Servidor',
  [PermissionFlagsBits.SendMessages]: 'Enviar Mensagens',
  [PermissionFlagsBits.EmbedLinks]: 'Inserir Links',
  [PermissionFlagsBits.ReadMessageHistory]: 'Ver Histórico de Mensagens',
  [PermissionFlagsBits.ViewChannel]: 'Ver Canal',
  [PermissionFlagsBits.AttachFiles]: 'Anexar Arquivos',
};

function permissionName(flag) {
  return NAMES[flag] ?? String(flag);
}
