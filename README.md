# OpenClaw Lark Plugin

A channel plugin for [OpenClaw](https://github.com/openclaw/openclaw) that enables integration with Lark (Larksuite/Feishu).

> **Attribution**: This plugin is inspired by and adapted from [moltbot-warehouse](https://github.com/sugarforever/moltbot-warehouse) by [@sugarforever](https://github.com/sugarforever). The original Moltbot/Clawdbot plugin was ported to work with OpenClaw.

## Features

- **Webhook Mode**: Receive messages via HTTP webhook
- **DM Support**: Direct messages with the bot
- **Group Support**: Receive @mentions in group chats
- **Image Support**: Send and receive images
- **Auto-reconnect**: Automatic crash recovery for webhook server

## Installation

1. Copy this plugin to your OpenClaw plugins directory:
   ```bash
   cp -r openclaw-lark-plugin ~/.openclaw/plugins/lark
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
             "appId": "your-lark-app-id",
             "appSecret": "your-lark-app-secret",
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

3. Set up your Lark app in [Lark Developer Console](https://open.larksuite.com/app):
   - Create an app and get App ID & App Secret
   - Enable Bot capability
   - Subscribe to `im.message.receive_v1` event
   - Set webhook URL to your server (e.g., `https://your-domain.com`)

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `appId` | Lark App ID | - |
| `appSecret` | Lark App Secret | - |
| `connectionMode` | `webhook` | `webhook` |
| `webhookPort` | Port for webhook server | `3000` |
| `domain` | `lark` or `feishu` | `lark` |
| `dmPolicy` | `open`, `pairing`, or `allowlist` | `pairing` |
| `groupPolicy` | `open` or `allowlist` | `open` |
| `encryptKey` | Event encryption key (optional) | - |
| `verificationToken` | Webhook verification token (optional) | - |

## Environment Variables

You can also configure via environment variables:
- `LARK_APP_ID`
- `LARK_APP_SECRET`
- `LARK_ENCRYPT_KEY`
- `LARK_VERIFICATION_TOKEN`

## Credits

- Original plugin: [moltbot-warehouse](https://github.com/sugarforever/moltbot-warehouse) by [@sugarforever](https://github.com/sugarforever)
- Ported to OpenClaw by [@notacryptodad](https://github.com/notacryptodad)

## License

MIT
