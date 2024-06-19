const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const bedrock = require('bedrock-protocol');

// Minecraft bot options
const botOptions = {
  host: 'play.lbsg.net',
  port: 19132,
  username: process.env.USER
};

// Discord bot client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let mcBot;
const MESSAGE_SPAM_COUNT = 20;
const MESSAGE_DELAY = 60 * 1000; // 2 minutes

client.on("ready", async () => {
  await sendWebhookMessage(`${client.user.tag} has awakened`);
  client.user.setActivity(`Recruiting on servers`);

  try {
    await client.application.commands.set([
      {
        name: 'srecruit',
        description: 'Recruit new members',
        options: [
          {
            name: 'max_sms',
            type: 4, // Integer type
            description: 'Max number of SMs to recruit',
            required: true
          },
          {
            name: 'sms_numbers',
            type: 3, // String type
            description: 'Comma-separated list of SM numbers',
            required: true
          }
        ]
      },
      {
        name: 'closebot',
        description: 'Terminate the program'
      }
    ]);

    await sendWebhookMessage('Commands registered successfully.');
  } catch (error) {
    await sendWebhookMessage('Failed to register commands: ' + error.message);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'srecruit') {
    const maxSms = interaction.options.getInteger('max_sms');
    const smsNumbersString = interaction.options.getString('sms_numbers');
    const smsNumbers = smsNumbersString.split(',').slice(0, maxSms).map(num => num.trim());

    try {
      await interaction.deferReply();
      await handleRecruitment(smsNumbers, interaction);
    } catch (error) {
      await sendWebhookMessage('Failed to handle recruitment: ' + error.message);
      await interaction.editReply('Failed to handle recruitment.');
    }
  } else if (interaction.commandName === 'closebot') {
    await interaction.reply('Terminating the program...');
    await sendWebhookMessage('Terminating the program...');
    process.exit(0);
  }
});

async function handleRecruitment(smsNumbers, interaction) {
  await sendWebhookMessage('Starting recruitment process...');

  mcBot = bedrock.createClient(botOptions);

  mcBot.on('connect', () => {
    sendWebhookMessage('Connected to the server');
  });

  mcBot.on('disconnect', (packet) => {
    sendWebhookMessage('Disconnected from the server: ' + JSON.stringify(packet));
  });

  mcBot.on('error', (error) => {
    sendWebhookMessage('An error occurred: ' + error.message);
  });

  mcBot.on('text', (packet) => {
    sendWebhookMessage(`Text message received: ${packet.message}`);
  });

  mcBot.on('spawn', async () => {
    sendWebhookMessage(`${mcBot.options.username} joined the server!`);
    for (const num of smsNumbers) {
      sendWebhookMessage(`Transferring to SM${num}...`);
      try {
        await queueCommand(`/transfer sm${num}`);
        await delay(5000); // Wait 5 seconds for the transfer to complete

        const embed = new EmbedBuilder()
          .setColor('#0099ff')
          .setTitle('Current Number')
          .setDescription(`The bot is now in number: ${num}`);

        await interaction.followUp({ embeds: [embed] });

        sendWebhookMessage(`Sending messages in SM${num}...`);
        for (let i = 0; i < MESSAGE_SPAM_COUNT; i++) {
          await mcBot.queue('text', {
            type: 'chat',
            needs_translation: false,
            source_name: mcBot.options.username,
            xuid: '',
            platform_chat_id: '',
            message: 'Join the largest LBSM clan today! add napoleonsm on disckord app to be invited to Imperium clan! Kits are provided and huge wars too!'
          });
          await delay(MESSAGE_DELAY);
        }

        await queueCommand('/hub');
        await delay(2 * 60 * 1000); // 2 minute delay before the next transfer
      } catch (error) {
        sendWebhookMessage(`Failed to transfer and spam for SM${num}: ` + error.message);
      }
    }

    await queueCommand('/hub');
    sendWebhookMessage('Recruitment process completed.');
  });

  mcBot.connect();
}

function queueCommand(command) {
  mcBot.queue('command_request', {
    command: command,
    origin: {
      type: "player",
      uuid: '',
      request_id: ''
    },
    internal: false,
  });
  return 'Command ran';
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWebhookMessage(message) {
  try {
    await axios.post(process.env.WEBURL, {
      content: message
    });
  } catch (error) {
    console.error('Failed to send webhook message:', error.message);
  }
}

client.login(process.env.TOKEN).catch(err => {
  console.error('Failed to login:', err);
});
