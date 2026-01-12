const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField, ChannelType } = require("discord.js");
const fs = require("fs");
const path = require("path");

const BOT_TOKEN = "BOT_TOKENINIZ";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration
  ]
});

// Sunucu kopyalama işlemleri için
const copyOperations = new Map(); // userId -> {sourceGuildId, targetGuildId, token}

client.once("ready", () => {
  console.log(`✅ Sunucu Kopyalama Botu Hazır: ${client.user.tag}`);
});

// En yüksek rol kontrolü
function hasHighestRole(member) {
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  if (member.id === member.guild.ownerId) return true;
  
  const botMember = member.guild.members.me;
  if (!botMember) return false;
  
  const userHighestRole = member.roles.highest;
  const botHighestRole = botMember.roles.highest;
  
  return userHighestRole.position > botHighestRole.position;
}

// Durum kontrolü (siccin kontrolü)
function hasSiccinStatus(member) {
  if (!member.presence) return false;
  
  const activities = member.presence.activities;
  if (!activities) return false;
  
  for (const activity of activities) {
    if (
      (activity.type === 0 && // Playing
       (activity.name.toLowerCase().includes('/siccin') || 
        activity.name.toLowerCase().includes('.gg/siccin'))) ||
      (activity.type === 2 && // Listening
       (activity.name.toLowerCase().includes('/siccin') || 
        activity.name.toLowerCase().includes('.gg/siccin'))) ||
      (activity.type === 3 && // Watching
       (activity.name.toLowerCase().includes('/siccin') || 
        activity.name.toLowerCase().includes('.gg/siccin'))) ||
      (activity.type === 4 && // Custom
       (activity.state && (activity.state.toLowerCase().includes('/siccin') || 
        activity.state.toLowerCase().includes('.gg/siccin'))))
    ) {
      return true;
    }
  }
  
  // Ayrıca durum mesajını da kontrol et
  const customStatus = activities.find(a => a.type === 4);
  if (customStatus && customStatus.state) {
    return customStatus.state.toLowerCase().includes('/siccin') || 
           customStatus.state.toLowerCase().includes('.gg/siccin');
  }
  
  return false;
}

// Sunucu kopyalama komutu
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('.pnl')) return;
  
  // En yüksek rol kontrolü
  if (!hasHighestRole(message.member)) {
    return message.reply({ 
      content: '❌ Bu komutu kullanmak için en yüksek role sahip olmalısınız!'
    });
  }
  
  // Durum kontrolü (/siccin veya .gg/siccin)
  if (!hasSiccinStatus(message.member)) {
    const warningEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ Erişim Engellendi!')
      .setDescription('Bu paneli kullanmak için durumunuzda **/siccin** veya **.gg/siccin** bulunmalıdır!')
      .addFields(
        { name: 'Gereksinimler', value: '1. En yüksek role sahip olmalısınız\n2. Durumunuzda /siccin veya .gg/siccin bulunmalı' },
        { name: 'Durumunuz', value: '❌ **/siccin** veya **.gg/siccin** bulunamadı!' }
      )
      .setFooter({ text: 'Durumunuzu güncelleyip tekrar deneyin.' });
    
    return message.reply({ embeds: [warningEmbed] });
  }
  
  // Sunucu kopyalama embed'ini gönder
  const embed = new EmbedBuilder()
    .setColor(0x2F3136)
    .setTitle("<:emoji_32:1460226323833290784> Sunucu Kopyalama")
    .setDescription("Sunucunuzu tamamen kopyalayın - Roller, Kanallar, Ayarlar ve daha fazlası!")
    .addFields(
      {
        name: "<:emoji_32:1460226323833290784> Özellikler:",
        value: 
          "<:emoji_32:1460226323833290784> Roller\n" +
          "<:emoji_32:1460226323833290784> Kanallar\n" +
          "<:emoji_32:1460226323833290784> Ayarlar\n" +
          "<:emoji_32:1460226323833290784> Loglar"
      },
      {
        name: "<:emoji_32:1460226323833290784> Kullanım:",
        value: 
          "<:emoji_32:1460226323833290784> 1 ID'leri girin\n" +
          "<:emoji_32:1460226323833290784> 2 Token ekleyin\n" +
          "<:emoji_32:1460226323833290784> 3 Butona tıklayın"
      }
    )
    .addFields(
      {
        name: "───────────────────────────────",
        value: "\u200b"
      },
      {
        name: "<:emoji_27:1459463541638697010> Uyarı:",
        value: 
          "<:emoji_32:1460226323833290784> Hesap, aktarım sunucusunda yetkili olmalı.\n" +
          "<:emoji_32:1460226323833290784> Hesap, kopyalanacak sunucuda olmalı.\n" +
          "<:emoji_32:1460226323833290784> Hesap her iki sunucuda da olmalı.\n" +
          "<:emoji_32:1460226323833290784> Tokeninizi kimseyle paylaşmayın."
      }
    )
    .setFooter({ 
      text: "Copyright © Developed by 1fors <:emoji_32:1460226323833290784>",
      iconURL: message.guild.iconURL() 
    });

  const button = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('start_copy')
        .setLabel('🚀 Kopyalamayı Başlat')
        .setStyle(ButtonStyle.Success)
        .setEmoji('1460226323833290784')
    );

  await message.reply({ embeds: [embed], components: [button] });
});

// Buton tıklama işleyici
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  
  if (interaction.customId === 'start_copy') {
    // Durum kontrolü (/siccin veya .gg/siccin)
    if (!hasSiccinStatus(interaction.member)) {
      const warningEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Erişim Engellendi!')
        .setDescription('Bu butonu kullanmak için durumunuzda **/siccin** veya **.gg/siccin** bulunmalıdır!')
        .addFields(
          { name: 'Gereksinim', value: 'Durumunuzu /siccin veya .gg/siccin olarak ayarlayın.' },
          { name: 'Şuanki Durum', value: '❌ **/siccin** veya **.gg/siccin** bulunamadı!' }
        );
      
      return interaction.reply({ embeds: [warningEmbed], ephemeral: true });
    }
    
    const modal = new ModalBuilder()
      .setCustomId('copy_modal')
      .setTitle('Sunucu Kopyalama Ayarları');

    // Discord Token Input
    const tokenInput = new TextInputBuilder()
      .setCustomId('discord_token')
      .setLabel('1. DISCORD TOKENİNİZ')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('WMTQwMTE2MzU5MzA....')
      .setRequired(true);

    // Kaynak Sunucu ID
    const sourceInput = new TextInputBuilder()
      .setCustomId('source_guild')
      .setLabel('2. KOPYALANACAK SUNUCU ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('11111111111111')
      .setRequired(true);

    // Hedef Sunucu ID
    const targetInput = new TextInputBuilder()
      .setCustomId('target_guild')
      .setLabel('3. YAPIŞTIRILACAK SUNUCU ID')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('11111111111111')
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder().addComponents(tokenInput);
    const secondActionRow = new ActionRowBuilder().addComponents(sourceInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(targetInput);

    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);
    
    await interaction.showModal(modal);
  }
  
  if (interaction.customId === 'confirm_copy') {
    // Durum kontrolü
    if (!hasSiccinStatus(interaction.member)) {
      return interaction.reply({ 
        content: '❌ Durumunuz değişti! Lütfen durumunuzu /siccin veya .gg/siccin olarak ayarlayın.',
        ephemeral: true 
      });
    }
    
    await interaction.deferReply({ ephemeral: true });
    
    const data = copyOperations.get(interaction.user.id);
    if (!data) {
      return interaction.editReply({ content: '❌ İşlem bulunamadı!' });
    }
    
    await interaction.editReply({ content: '🔄 Sunucu kopyalama başlatılıyor... Bu işlem biraz zaman alabilir.' });
    
    try {
      await copyServer(data.token, data.sourceGuildId, data.targetGuildId, interaction);
      copyOperations.delete(interaction.user.id);
    } catch (error) {
      await interaction.followUp({ content: `❌ Kopyalama hatası: ${error.message}`, ephemeral: true });
    }
  }
  
  if (interaction.customId === 'cancel_copy') {
    copyOperations.delete(interaction.user.id);
    await interaction.reply({ content: '❌ İşlem iptal edildi!', ephemeral: true });
  }
});

// Modal submit işleyici
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  
  if (interaction.customId === 'copy_modal') {
    // Durum kontrolü
    if (!hasSiccinStatus(interaction.member)) {
      const warningEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Erişim Engellendi!')
        .setDescription('Durumunuz değişti! İşleme devam etmek için durumunuzda **/siccin** veya **.gg/siccin** bulunmalıdır!')
        .setFooter({ text: 'Lütfen durumunuzu güncelleyip tekrar deneyin.' });
      
      return interaction.reply({ embeds: [warningEmbed], ephemeral: true });
    }
    
    await interaction.deferReply({ ephemeral: true });
    
    const token = interaction.fields.getTextInputValue('discord_token').trim();
    const sourceGuildId = interaction.fields.getTextInputValue('source_guild').trim();
    const targetGuildId = interaction.fields.getTextInputValue('target_guild').trim();
    
    // Token kontrolü
    const tokenValid = await validateToken(token);
    
    if (!tokenValid) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Token Hatalı!')
        .setDescription('Girdiğiniz Discord tokeni geçersiz veya hatalı.')
        .addFields(
          { name: 'Hata Kodu', value: 'INVALID_TOKEN', inline: true },
          { name: 'Çözüm', value: 'Lütfen geçerli bir Discord tokeni girin.', inline: true }
        )
        .setTimestamp();
      
      return interaction.editReply({ embeds: [errorEmbed] });
    }
    
    // Sunucu ID'lerini kontrol et
    const sourceGuild = client.guilds.cache.get(sourceGuildId);
    const targetGuild = client.guilds.cache.get(targetGuildId);
    
    if (!sourceGuild || !targetGuild) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Sunucu Bulunamadı!')
        .setDescription('Girdiğiniz sunucu ID\'leri geçersiz veya bot bu sunucularda değil.')
        .addFields(
          { name: 'Kopyalanacak Sunucu', value: sourceGuild ? '✅ Bulundu' : '❌ Bulunamadı', inline: true },
          { name: 'Yapıştırılacak Sunucu', value: targetGuild ? '✅ Bulundu' : '❌ Bulunamadı', inline: true }
        )
        .setTimestamp();
      
      return interaction.editReply({ embeds: [errorEmbed] });
    }
    
    // Bilgileri kaydet
    copyOperations.set(interaction.user.id, {
      token: token,
      sourceGuildId: sourceGuildId,
      targetGuildId: targetGuildId,
      timestamp: Date.now(),
      userTag: interaction.user.tag
    });
    
    // Onay embed'i
    const confirmEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Token Doğrulandı!')
      .setDescription('Sunucu kopyalama işlemi başlatılmaya hazır.')
      .addFields(
        { name: 'Kopyalanacak Sunucu', value: sourceGuild.name, inline: true },
        { name: 'Yapıştırılacak Sunucu', value: targetGuild.name, inline: true },
        { name: 'Token Sahibi', value: tokenValid.username, inline: true }
      )
      .addFields(
        { 
          name: '⚠️ DİKKAT', 
          value: 'Bu işlem **yapıştırılacak sunucudaki tüm kanal ve rolleri silecektir**!\n**Devam etmek istiyor musunuz?**' 
        }
      )
      .setFooter({ text: `Durum Kontrolü: ✅ /siccin veya .gg/siccin mevcut` })
      .setTimestamp();
    
    const confirmButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_copy')
          .setLabel('✅ EVET, KOPYALAMAYI BAŞLAT')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancel_copy')
          .setLabel('❌ HAYIR, İPTAL ET')
          .setStyle(ButtonStyle.Danger)
      );
    
    await interaction.editReply({ 
      embeds: [confirmEmbed], 
      components: [confirmButtons] 
    });
  }
});

// Token doğrulama fonksiyonu
async function validateToken(token) {
  try {
    const { Client: SelfClient } = require('discord.js-selfbot-v13');
    const testClient = new SelfClient({ checkUpdate: false });
    
    await testClient.login(token);
    
    const userData = {
      id: testClient.user.id,
      username: testClient.user.tag,
      avatar: testClient.user.displayAvatarURL()
    };
    
    testClient.destroy();
    return userData;
  } catch (error) {
    console.log('Token doğrulama hatası:', error.message);
    return false;
  }
}

// Sunucu kopyalama fonksiyonu
async function copyServer(token, sourceGuildId, targetGuildId, interaction) {
  try {
    // Self-bot client'ı başlat
    const { Client: SelfClient } = require('discord.js-selfbot-v13');
    const userClient = new SelfClient({ checkUpdate: false });
    
    await userClient.login(token);
    
    const sourceGuild = userClient.guilds.cache.get(sourceGuildId);
    const targetGuild = userClient.guilds.cache.get(targetGuildId);
    
    if (!sourceGuild || !targetGuild) {
      throw new Error('Hesap belirtilen sunucularda değil!');
    }
    
    // Kullanıcının yetkilerini kontrol et
    const sourceMember = sourceGuild.members.cache.get(userClient.user.id);
    const targetMember = targetGuild.members.cache.get(userClient.user.id);
    
    if (!sourceMember || !targetMember) {
      throw new Error('Hesap her iki sunucuda da bulunmalı!');
    }
    
    if (!targetMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
      throw new Error('Hedef sunucuda admin yetkisi gerekiyor!');
    }
    
    // İşlem başladı embed'i
    const startEmbed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('🔄 Sunucu Kopyalama Başladı')
      .setDescription('Sunucu kopyalama işlemi başlatıldı. Lütfen bekleyin...')
      .addFields(
        { name: 'Kaynak Sunucu', value: sourceGuild.name, inline: true },
        { name: 'Hedef Sunucu', value: targetGuild.name, inline: true },
        { name: 'Durum', value: 'Hazırlanıyor...', inline: true }
      )
      .setFooter({ text: 'Bu işlem birkaç dakika sürebilir.' })
      .setTimestamp();
    
    await interaction.followUp({ embeds: [startEmbed] });
    
    // 1. Hedef sunucudaki tüm kanalları sil
    await deleteAllChannels(targetGuild, interaction);
    
    // 2. Hedef sunucudaki tüm rolleri sil (@everyone hariç)
    await deleteAllRoles(targetGuild, interaction);
    
    // 3. Rolleri kopyala
    await copyRoles(sourceGuild, targetGuild, interaction);
    
    // 4. Kategorileri kopyala
    await copyCategories(sourceGuild, targetGuild, interaction);
    
    // 5. Kanalları kopyala
    await copyChannels(sourceGuild, targetGuild, interaction);
    
    // 6. Sunucu ayarlarını kopyala (mümkün olanlar)
    await copyServerSettings(sourceGuild, targetGuild, interaction);
    
    // Başarı embed'i
    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ Sunucu Kopyalama Tamamlandı!')
      .setDescription(`${sourceGuild.name} sunucusu başarıyla ${targetGuild.name} sunucusuna kopyalandı.`)
      .addFields(
        { name: 'Kopyalanan Öğeler', value: '✅ Roller\n✅ Kanallar\n✅ Kategoriler\n✅ İzinler', inline: true },
        { name: 'İşlem Süresi', value: `${Math.floor((Date.now() - copyOperations.get(interaction.user.id)?.timestamp) / 1000)} saniye`, inline: true },
        { name: 'Durum', value: '✅ Başarılı', inline: true }
      )
      .setFooter({ text: 'Copyright © Developed by 1fors | Durum: ✅ /siccin mevcut' })
      .setTimestamp();
    
    await interaction.followUp({ embeds: [successEmbed] });
    
    // Self-bot client'ı kapat
    userClient.destroy();
    
  } catch (error) {
    throw error;
  }
}

// Tüm kanalları sil
async function deleteAllChannels(guild, interaction) {
  const channels = guild.channels.cache;
  let deleted = 0;
  const total = channels.size;
  
  const progressEmbed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('🗑️ Kanallar Siliniyor...')
    .setDescription(`**${deleted}/${total}** kanal silindi`)
    .setTimestamp();
  
  const progressMessage = await interaction.followUp({ embeds: [progressEmbed], ephemeral: true });
  
  for (const [id, channel] of channels) {
    try {
      await channel.delete();
      deleted++;
      
      // Her silinende güncelle
      if (deleted % 2 === 0 || deleted === total) {
        progressEmbed.setDescription(`**${deleted}/${total}** kanal silindi`);
        await progressMessage.edit({ embeds: [progressEmbed] });
      }
      
      await delay(1000);
    } catch (error) {
      console.log(`Kanal silme hatası: ${error.message}`);
    }
  }
  
  await progressMessage.delete();
}

// Tüm rolleri sil (@everyone hariç)
async function deleteAllRoles(guild, interaction) {
  const roles = guild.roles.cache.filter(role => !role.managed && role.id !== guild.id);
  let deleted = 0;
  const total = roles.size;
  
  if (total === 0) return;
  
  const progressEmbed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('🗑️ Roller Siliniyor...')
    .setDescription(`**${deleted}/${total}** rol silindi`)
    .setTimestamp();
  
  const progressMessage = await interaction.followUp({ embeds: [progressEmbed], ephemeral: true });
  
  for (const [id, role] of roles) {
    try {
      await role.delete();
      deleted++;
      
      // Her silinende güncelle
      if (deleted % 2 === 0 || deleted === total) {
        progressEmbed.setDescription(`**${deleted}/${total}** rol silindi`);
        await progressMessage.edit({ embeds: [progressEmbed] });
      }
      
      await delay(1000);
    } catch (error) {
      console.log(`Rol silme hatası: ${error.message}`);
    }
  }
  
  await progressMessage.delete();
}

// Rolleri kopyala
async function copyRoles(sourceGuild, targetGuild, interaction) {
  const roles = sourceGuild.roles.cache
    .filter(role => !role.managed && role.id !== sourceGuild.id)
    .sort((a, b) => b.position - a.position);
  
  let created = 0;
  const total = roles.size;
  const roleMap = new Map();
  
  if (total === 0) return roleMap;
  
  // @everyone rolünü kaydet
  roleMap.set(sourceGuild.id, targetGuild.id);
  
  const progressEmbed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('👥 Roller Kopyalanıyor...')
    .setDescription(`**${created}/${total}** rol oluşturuldu`)
    .setTimestamp();
  
  const progressMessage = await interaction.followUp({ embeds: [progressEmbed], ephemeral: true });
  
  for (const [id, role] of roles) {
    try {
      const newRole = await targetGuild.roles.create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        permissions: role.permissions,
        mentionable: role.mentionable,
        position: role.position,
        reason: `Sunucu kopyalama - ${sourceGuild.name} -> ${targetGuild.name}`
      });
      
      roleMap.set(id, newRole.id);
      created++;
      
      // Her oluşturmada güncelle
      progressEmbed.setDescription(`**${created}/${total}** rol oluşturuldu\n**Son rol:** ${role.name}`);
      await progressMessage.edit({ embeds: [progressEmbed] });
      
      await delay(2000);
    } catch (error) {
      console.log(`Rol kopyalama hatası: ${error.message}`);
    }
  }
  
  await progressMessage.delete();
  return roleMap;
}

// Kategorileri kopyala
async function copyCategories(sourceGuild, targetGuild, interaction) {
  const categories = sourceGuild.channels.cache
    .filter(channel => channel.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position);
  
  const categoryMap = new Map();
  let created = 0;
  const total = categories.size;
  
  if (total === 0) return categoryMap;
  
  const progressEmbed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('📁 Kategoriler Kopyalanıyor...')
    .setDescription(`**${created}/${total}** kategori oluşturuldu`)
    .setTimestamp();
  
  const progressMessage = await interaction.followUp({ embeds: [progressEmbed], ephemeral: true });
  
  for (const [id, category] of categories) {
    try {
      // İzinleri dönüştür
      const permissionOverwrites = [];
      for (const [overwriteId, overwrite] of category.permissionOverwrites.cache) {
        const targetId = overwriteId === sourceGuild.id ? targetGuild.id : overwriteId;
        
        permissionOverwrites.push({
          id: targetId,
          allow: overwrite.allow,
          deny: overwrite.deny
        });
      }
      
      const newCategory = await targetGuild.channels.create({
        name: category.name,
        type: ChannelType.GuildCategory,
        position: category.position,
        permissionOverwrites: permissionOverwrites,
        reason: `Sunucu kopyalama - ${sourceGuild.name} -> ${targetGuild.name}`
      });
      
      categoryMap.set(id, newCategory.id);
      created++;
      
      // Güncelleme
      progressEmbed.setDescription(`**${created}/${total}** kategori oluşturuldu\n**Son kategori:** ${category.name}`);
      await progressMessage.edit({ embeds: [progressEmbed] });
      
      await delay(2000);
    } catch (error) {
      console.log(`Kategori kopyalama hatası: ${error.message}`);
    }
  }
  
  await progressMessage.delete();
  return categoryMap;
}

// Kanalları kopyala (metin ve ses)
async function copyChannels(sourceGuild, targetGuild, interaction) {
  // Metin kanalları (kategori dışındaki)
  const textChannels = sourceGuild.channels.cache
    .filter(channel => channel.type === ChannelType.GuildText && !channel.parentId)
    .sort((a, b) => a.position - b.position);
  
  // Ses kanalları (kategori dışındaki)
  const voiceChannels = sourceGuild.channels.cache
    .filter(channel => channel.type === ChannelType.GuildVoice && !channel.parentId)
    .sort((a, b) => a.position - b.position);
  
  let created = 0;
  const total = textChannels.size + voiceChannels.size;
  
  if (total === 0) return;
  
  const progressEmbed = new EmbedBuilder()
    .setColor(0x00FF00)
    .setTitle('💬 Kanallar Kopyalanıyor...')
    .setDescription(`**${created}/${total}** kanal oluşturuldu`)
    .setTimestamp();
  
  const progressMessage = await interaction.followUp({ embeds: [progressEmbed], ephemeral: true });
  
  // Metin kanallarını kopyala
  for (const [id, channel] of textChannels) {
    try {
      const permissionOverwrites = [];
      for (const [overwriteId, overwrite] of channel.permissionOverwrites.cache) {
        const targetId = overwriteId === sourceGuild.id ? targetGuild.id : overwriteId;
        
        permissionOverwrites.push({
          id: targetId,
          allow: overwrite.allow,
          deny: overwrite.deny
        });
      }
      
      await targetGuild.channels.create({
        name: channel.name,
        type: ChannelType.GuildText,
        position: channel.position,
        topic: channel.topic,
        nsfw: channel.nsfw,
        rateLimitPerUser: channel.rateLimitPerUser,
        permissionOverwrites: permissionOverwrites,
        reason: `Sunucu kopyalama - ${sourceGuild.name} -> ${targetGuild.name}`
      });
      
      created++;
      progressEmbed.setDescription(`**${created}/${total}** kanal oluşturuldu\n**Son kanal:** #${channel.name}`);
      await progressMessage.edit({ embeds: [progressEmbed] });
      
      await delay(2000);
    } catch (error) {
      console.log(`Metin kanalı kopyalama hatası: ${error.message}`);
    }
  }
  
  // Ses kanallarını kopyala
  for (const [id, channel] of voiceChannels) {
    try {
      const permissionOverwrites = [];
      for (const [overwriteId, overwrite] of channel.permissionOverwrites.cache) {
        const targetId = overwriteId === sourceGuild.id ? targetGuild.id : overwriteId;
        
        permissionOverwrites.push({
          id: targetId,
          allow: overwrite.allow,
          deny: overwrite.deny
        });
      }
      
      await targetGuild.channels.create({
        name: channel.name,
        type: ChannelType.GuildVoice,
        position: channel.position,
        bitrate: channel.bitrate,
        userLimit: channel.userLimit,
        permissionOverwrites: permissionOverwrites,
        reason: `Sunucu kopyalama - ${sourceGuild.name} -> ${targetGuild.name}`
      });
      
      created++;
      progressEmbed.setDescription(`**${created}/${total}** kanal oluşturuldu\n**Son kanal:** 🔊 ${channel.name}`);
      await progressMessage.edit({ embeds: [progressEmbed] });
      
      await delay(2000);
    } catch (error) {
      console.log(`Ses kanalı kopyalama hatası: ${error.message}`);
    }
  }
  
  await progressMessage.delete();
}

// Sunucu ayarlarını kopyala
async function copyServerSettings(sourceGuild, targetGuild, interaction) {
  try {
    const progressEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('⚙️ Ayarlar Kopyalanıyor...')
      .setDescription('Sunucu ayarları güncelleniyor')
      .setTimestamp();
    
    const progressMessage = await interaction.followUp({ embeds: [progressEmbed], ephemeral: true });
    
    // Mümkün olan ayarları kopyala
    await targetGuild.setName(sourceGuild.name);
    await delay(1000);
    
    if (sourceGuild.icon) {
      await targetGuild.setIcon(sourceGuild.iconURL());
      await delay(1000);
    }
    
    // Afk kanalı ve süresi
    const afkChannel = sourceGuild.afkChannel;
    if (afkChannel) {
      const targetAfkChannel = targetGuild.channels.cache.find(ch => ch.name === afkChannel.name);
      if (targetAfkChannel) {
        await targetGuild.setAFKChannel(targetAfkChannel);
        await targetGuild.setAFKTimeout(sourceGuild.afkTimeout);
        await delay(1000);
      }
    }
    
    // Sistem kanalı
    const systemChannel = sourceGuild.systemChannel;
    if (systemChannel) {
      const targetSystemChannel = targetGuild.channels.cache.find(ch => ch.name === systemChannel.name);
      if (targetSystemChannel) {
        await targetGuild.setSystemChannel(targetSystemChannel);
        await delay(1000);
      }
    }
    
    progressEmbed.setDescription('✅ Sunucu ayarları kopyalandı!');
    await progressMessage.edit({ embeds: [progressEmbed] });
    
    await delay(1000);
    await progressMessage.delete();
    
  } catch (error) {
    console.log(`Ayarlar kopyalama hatası: ${error.message}`);
  }
}

// Yardımcı fonksiyonlar
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Ana botu başlat
client.login(BOT_TOKEN).catch(console.error);
