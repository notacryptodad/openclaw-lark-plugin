# Lark App Setup Guide

Complete guide to creating and configuring a Lark app for use with OpenClaw.

## Step 1: Create a Lark App

1. Go to [Lark Developer Console](https://open.larksuite.com/app) (or [Feishu](https://open.feishu.cn/app) for China)
2. Click **Create Custom App**
3. Fill in:
   - **App Name**: Your bot name (e.g., "Cody Bot")
   - **App Description**: Brief description
   - **App Icon**: Upload an icon (optional)
4. Click **Create**

## Step 2: Get Credentials

Go to **Credentials & Basic Info**:

- Copy **App ID** (starts with `cli_`)
- Copy **App Secret**

Save these for your OpenClaw config.

## Step 3: Enable Bot Capability

Go to **Features** → **Bot**:

1. Toggle **Enable Bot** to ON
2. Configure bot settings:
   - **Bot Name**: Display name in chats
   - Check **"Receive group @ messages"** if you want group support

## Step 4: Configure Permissions

Go to **Permissions & Scopes** and add these permissions:

### Required Permissions

| Permission | Scope | Description |
|------------|-------|-------------|
| `im:message` | Read and send messages | Core messaging |
| `im:message:send_as_bot` | Send messages as bot | Reply to users |
| `im:chat:readonly` | Read chat info | Get chat details |

### Optional Permissions (for extended features)

| Permission | Scope | Description |
|------------|-------|-------------|
| `im:message.group_at_msg` | Receive group @mentions | Bot responds when @mentioned in groups |
| `im:chat` | Manage chats | Create/update group info |
| `im:resource` | Access message resources | Download images/files |
| `contact:user.base:readonly` | Read user info | Get sender names |

After adding permissions, click **Batch Activate** or activate individually.

## Step 5: Configure Event Subscriptions

Go to **Event Subscriptions**:

### 1. Set Request URL

Enter your webhook URL:
```
https://lark.yourdomain.com
```

Click **Verify** - Lark will send a challenge request. If OpenClaw is running with the tunnel configured, it should pass automatically.

### 2. Subscribe to Events

Add these events:

| Event | API Name | Description |
|-------|----------|-------------|
| **Message received** | `im.message.receive_v1` | **Required** - Receive user messages |
| Bot added to group | `im.chat.member.bot.added_v1` | Know when bot joins a group |
| Bot removed from group | `im.chat.member.bot.deleted_v1` | Know when bot leaves a group |

### 3. (Optional) Encryption Settings

For added security, you can enable:
- **Encrypt Key**: Encrypts event payloads
- **Verification Token**: Validates requests are from Lark

If you enable these, add them to your OpenClaw config:
```json
{
  "channels": {
    "lark": {
      "accounts": {
        "default": {
          "encryptKey": "your-encrypt-key",
          "verificationToken": "your-verification-token"
        }
      }
    }
  }
}
```

## Step 6: Publish the App

Go to **App Release** → **Version Management**:

1. Click **Create Version**
2. Fill in version notes
3. Set **Availability**:
   - **All employees**: Anyone in your org can use the bot
   - **Specific departments/users**: Restrict access
4. Click **Submit for Review** (or **Publish** for self-built apps)

⚠️ **Important**: The bot won't respond until the app is published/approved!

## Step 7: Test the Bot

### Test DM (Direct Message)

1. Open Lark app
2. Search for your bot name
3. Start a chat and send a message
4. Bot should respond!

### Test Group Chat

1. Create or open a group
2. Click group settings → **Bots** → **Add Bot**
3. Search and add your bot
4. @mention the bot: `@YourBot hello`
5. Bot should respond!

## Troubleshooting

### Bot doesn't respond

1. **Check app is published**: Unpublished apps won't receive events
2. **Check permissions**: Ensure `im:message` is activated
3. **Check event subscription**: `im.message.receive_v1` must be subscribed
4. **Check webhook URL**: Verify the URL is correct and accessible
5. **Check OpenClaw logs**: Look for incoming events

### Verification fails

1. Ensure OpenClaw is running
2. Ensure Cloudflare tunnel is running
3. Test manually:
   ```bash
   curl -X POST https://lark.yourdomain.com/ \
     -H "Content-Type: application/json" \
     -d '{"type":"url_verification","challenge":"test"}'
   ```
   Should return: `{"challenge":"test"}`

### Bot can't send messages

1. Check `im:message:send_as_bot` permission is activated
2. Check App ID and Secret are correct in config
3. Check domain setting (`lark` vs `feishu`)

### Group @mentions don't work

1. Enable **"Receive group @ messages"** in Bot settings
2. Add `im:message.group_at_msg` permission
3. Make sure to @mention the bot by name

## Configuration Reference

Complete OpenClaw config example:

```json
{
  "channels": {
    "lark": {
      "accounts": {
        "default": {
          "appId": "cli_xxxxxxxxxx",
          "appSecret": "xxxxxxxxxxxxxxxxxxxxxxxx",
          "domain": "lark",
          "connectionMode": "webhook",
          "webhookPort": 3000,
          "dmPolicy": "open",
          "groupPolicy": "open",
          "groupMentionGated": true
        }
      }
    }
  }
}
```

### Policy Options

| Setting | Options | Description |
|---------|---------|-------------|
| `dmPolicy` | `open`, `pairing`, `allowlist` | Who can DM the bot |
| `groupPolicy` | `open`, `allowlist` | Which groups bot responds in |
| `groupMentionGated` | `true`, `false` | Require @mention in groups |

## External Groups Limitation

⚠️ **Note**: Lark App Bots cannot be added to external groups (groups with members outside your organization). External groups only support Custom Bots (webhooks), which are one-way outbound only.

If you need bot functionality in an external group:
1. Create the group yourself (you must be the owner)
2. Invite external members to YOUR group
3. Then add your bot - this works because you own the group
