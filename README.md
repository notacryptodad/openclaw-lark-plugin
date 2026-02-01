# OpenClaw Lark Plugin

A channel plugin for [OpenClaw](https://github.com/openclaw/openclaw) that enables integration with Lark (Larksuite/Feishu).

> **Attribution**: This plugin is inspired by and adapted from [moltbot-warehouse](https://github.com/sugarforever/moltbot-warehouse) by [@sugarforever](https://github.com/sugarforever). The original Moltbot/Clawdbot plugin was ported to work with OpenClaw.

## Features

- **Webhook Mode**: Receive messages via HTTP webhook
- **DM Support**: Direct messages with the bot
- **Group Support**: Receive @mentions in group chats
- **Image Support**: Send and receive images
- **Auto-reconnect**: Automatic crash recovery for webhook server

## Quick Start

1. [Create and configure your Lark App](docs/lark-app-setup.md)
2. [Set up Cloudflare Tunnel](docs/cloudflare-tunnel-setup.md) for webhook exposure
3. Install and configure this plugin (see below)

## Installation

1. Copy this plugin to your OpenClaw plugins directory:
   ```bash
   git clone https://github.com/notacryptodad/openclaw-lark-plugin.git ~/.openclaw/plugins/lark
   cd ~/.openclaw/plugins/lark
   npm install
   ```

2. Update your OpenClaw config (`~/.openclaw/openclaw.json`):
   ```json
   {
     "plugins": {
       "load": {
         "paths": ["~/.openclaw/plugins/lark"]
       },
       "entries": {
         "lark": { "enabled": true }
       }
     },
     "channels": {
       "lark": {
         "accounts": {
           "default": {
             "appId": "cli_xxxxxxxxxx",
             "appSecret": "your-app-secret",
             "connectionMode": "webhook",
             "webhookPort": 3000,
             "domain": "lark",
             "dmPolicy": "open"
           }
         }
       }
     }
   }
   ```

3. Restart OpenClaw gateway

## Documentation

- **[Lark App Setup Guide](docs/lark-app-setup.md)** - Create app, configure permissions, enable events
- **[Cloudflare Tunnel Setup](docs/cloudflare-tunnel-setup.md)** - Expose webhook endpoint securely

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `appId` | Lark App ID (from Developer Console) | - |
| `appSecret` | Lark App Secret | - |
| `connectionMode` | `webhook` | `webhook` |
| `webhookPort` | Port for webhook server | `3000` |
| `domain` | `lark` (international) or `feishu` (China) | `lark` |
| `dmPolicy` | `open`, `pairing`, or `allowlist` | `pairing` |
| `groupPolicy` | `open` or `allowlist` | `open` |
| `groupMentionGated` | Require @mention in groups | `true` |
| `encryptKey` | Event encryption key (optional) | - |
| `verificationToken` | Webhook verification token (optional) | - |

## Environment Variables

Alternative to config file:
- `LARK_APP_ID`
- `LARK_APP_SECRET`
- `LARK_ENCRYPT_KEY`
- `LARK_VERIFICATION_TOKEN`

## Required Lark Permissions

| Permission | Required | Description |
|------------|----------|-------------|
| `im:message` | ✅ Yes | Read and send messages |
| `im:message:send_as_bot` | ✅ Yes | Send messages as bot |
| `im:message.group_at_msg` | For groups | Receive @mentions |
| `im:chat:readonly` | Recommended | Read chat info |

## Required Event Subscriptions

| Event | Required | Description |
|-------|----------|-------------|
| `im.message.receive_v1` | ✅ Yes | Receive messages |
| `im.chat.member.bot.added_v1` | Optional | Bot added to group |

## Credits

- Original plugin: [moltbot-warehouse](https://github.com/sugarforever/moltbot-warehouse) by [@sugarforever](https://github.com/sugarforever)
- Ported to OpenClaw by [@notacryptodad](https://github.com/notacryptodad)

## License

MIT
