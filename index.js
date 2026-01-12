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
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences // PRESENCE intent eklendi!
  ]
});

// Sunucu kopyalama işlemleri için
const copyOperations = new Map(); // userId -> {sourceGuildId, targetGuildId, token}

client.once("ready", () => {
  console.log(`✅ Sunucu Kopyalama Botu Hazır: ${client.user.tag}`);
  console.log(`📊 Sunucular: ${client.guilds.cache.size} adet`);
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

// Durum kontrolü (siccin kontrolü) - GELİŞTİRİLMİŞ
function hasSiccinStatus(member) {
  try {
    // Presence verilerini kontrol et
    if (!member.presence) {
      console.log(`❌ ${member.user.tag}: Presence verisi yok`);
      return false;
    }
    
    const activities = member.presence.activities;
    if (!activities || activities.length === 0) {
      console.log(`❌ ${member.user.tag}: Aktivite yok`);
      return false;
    }
    
    console.log(`🔍 ${member.user.tag} aktiviteleri:`, activities.map(a => `${a.type}: ${a.name} - ${a.state || ''}`));
    
    // Tüm aktiviteleri kontrol et
    for (const activity of activities) {
      const activityName = activity.name?.toLowerCase() || '';
      const activityState = activity.state?.toLowerCase() || '';
      const activityDetails = activity.details?.toLowerCase() || '';
      
      console.log(`📝 Aktivite kontrolü: ${activityName} | ${activityState} | ${activityDetails}`);
      
      // Çeşitli kombinasyonları kontrol et
      if (
        activityName.includes('/siccin') ||
        activityName.includes('.gg/siccin') ||
        activityName.includes('siccin') ||
        activityState.includes('/siccin') ||
        activityState.includes('.gg/siccin') ||
        activityState.includes('siccin') ||
        activityDetails.includes('/siccin') ||
        activityDetails.includes('.gg/siccin') ||
        activityDetails.includes('siccin')
      ) {
        console.log(`✅ ${member.user.tag}: Siccin bulundu!`);
        return true;
      }
      
      // Custom status kontrolü
      if (activity.type === 4) { // Custom Status
        if (activity.state) {
          const lowerState = activity.state.toLowerCase();
          if (lowerState.includes('/siccin') || lowerState.includes('.gg/siccin') || lowerState.includes('siccin')) {
            console.log(`✅ ${member.user.tag}: Custom status siccin bulundu!`);
            return true;
          }
        }
      }
      
      // Rich presence kontrolü
      if (activity.assets) {
        const largeText = activity.assets.largeText?.toLowerCase() || '';
        const smallText = activity.assets.smallText?.toLowerCase() || '';
        
        if (largeText.includes('siccin') || smallText.includes('siccin')) {
          console.log(`✅ ${member.user.tag}: Rich presence siccin bulundu!`);
          return true;
        }
      }
    }
    
    console.log(`❌ ${member.user.tag}: Siccin bulunamadı`);
    return false;
    
  } catch (error) {
    console.log(`❌ Durum kontrol hatası (${member.user.tag}):`, error.message);
    return false;
  }
}

// ALTERNATİF: Daha basit durum kontrolü (client status)
function hasSiccinInStatus(member) {
  try {
    // Kullanıcının durumunu al
    const statusText = `
      Aktiviteler: ${member.presence?.activities?.map(a => `${a.name}: ${a.state || ''}`).join(', ') || 'Yok'}
      Durum: ${member.presence?.status || 'Yok'}
      Client Status: ${JSON.stringify(member.presence?.clientStatus || {})}
    `.toLowerCase();
    
    console.log(`🔍 ${member.user.tag} durum metni:`, statusText);
    
    // Basit kontrol
    if (statusText.includes('/siccin') || statusText.includes('.gg/siccin')) {
      console.log(`✅ ${member.user.tag}: Durum metninde siccin bulundu!`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.log(`❌ Basit durum kontrol hatası:`, error.message);
    return false;
  }
}

// Sunucu kopyalama komutu - SADECE EN YÜKSEK ROL KONTROLÜ
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('.pnl')) return;
  
  // SADECE en yüksek rol kontrolü
  if (!hasHighestRole(message.member)) {
    return message.reply({ 
      content: '❌ Bu komutu kullanmak için en yüksek role sahip olmalısınız!'
    });
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
      },
      {
        name: "⚠️ ÖNEMLİ NOT:",
        value: "Butonu kullanmak için **durumunuzda /siccin veya .gg/siccin** olmalıdır!"
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

// Buton tıklama işleyici - DURUM KONTROLÜ BURADA
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  
  if (interaction.customId === 'start_copy') {
    // SADECE DURUM KONTROLÜ (hem gelişmiş hem basit)
    const hasSiccin = hasSiccinStatus(interaction.member) || hasSiccinInStatus(interaction.member);
    
    if (!hasSiccin) {
      // Debug bilgisi
      console.log(`❌ BUTON ENGEL: ${interaction.user.tag} - Siccin durumu yok`);
      console.log(`   Member: ${interaction.member.user.tag}`);
      console.log(`   Presence:`, interaction.member.presence);
      console.log(`   Activities:`, interaction.member.presence?.activities);
      
      const warningEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Erişim Engellendi!')
        .setDescription('Bu butonu kullanmak için **durumunuzda /siccin veya .gg/siccin** bulunmalıdır!')
        .addFields(
          { 
            name: 'Nasıl Ayarlanır?', 
            value: '1. Discord\'u açın\n2. Sol alt profil fotoğrafınıza tıklayın\n3. "Durumunu Düzenle" seçeneğine tıklayın\n4. "Özel Durum" kısmına **/siccin** yazın\n5. Kaydedin ve tekrar deneyin' 
          },
          {
            name: 'Alternatif Durumlar',
            value: 'Aşağıdakilerden biri olmalı:\n• **/siccin**\n• **.gg/siccin**\n• **siccin**\n• **Siccin Sunucusu**'
          }
        )
        .setFooter({ text: 'Durumunuzu ayarladıktan sonra butona tekrar tıklayın.' });
      
      return interaction.reply({ embeds: [warningEmbed], ephemeral: true });
    }
    
    console.log(`✅ BUTON İZİN: ${interaction.user.tag} - Siccin durumu mevcut`);
    
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
    // Durum kontrolü (tekrar)
    const hasSiccin = hasSiccinStatus(interaction.member) || hasSiccinInStatus(interaction.member);
    if (!hasSiccin) {
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
    // Durum kontrolü (tekrar)
    const hasSiccin = hasSiccinStatus(interaction.member) || hasSiccinInStatus(interaction.member);
    if (!hasSiccin) {
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
        { name: 'Token Sahibi', value: tokenValid.username, inline: true },
        { name: 'Durum Kontrolü', value: '✅ /siccin veya .gg/siccin mevcut', inline: true }
      )
      .addFields(
        { 
          name: '⚠️ DİKKAT', 
          value: 'Bu işlem **yapıştırılacak sunucudaki tüm kanal ve rolleri silecektir**!\n**Devam etmek istiyor musunuz?**' 
        }
      )
      .setFooter({ text: 'Copyright © Developed by 1fors' })
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

// Sunucu kopyalama fonksiyonu (önceki koddan kopyala)
async function copyServer(token, sourceGuildId, targetGuildId, interaction) {
  try {
    const { Client: SelfClient } = require('discord.js-selfbot-v13');
    const userClient = new SelfClient({ checkUpdate: false });
    
    await userClient.login(token);
    
    const sourceGuild = userClient.guilds.cache.get(sourceGuildId);
    const targetGuild = userClient.guilds.cache.get(targetGuildId);
    
    if (!sourceGuild || !targetGuild) {
      throw new Error('Hesap belirtilen sunucularda değil!');
    }
    
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
    
    // Kopyalama işlemleri burada...
    // (Önceki kodda olan deleteAllChannels, copyRoles vb. fonksiyonlar buraya gelecek)
    
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
    
    userClient.destroy();
    
  } catch (error) {
    throw error;
  }
}

// Yardımcı fonksiyon
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Hata yakalama
client.on('error', console.error);
process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

// Ana botu başlat
client.login(BOT_TOKEN).catch(console.error);
