# Cloudflare Tunnel Setup for Lark Webhook

Lark's webhook mode requires a publicly accessible HTTPS endpoint. This guide shows how to set up Cloudflare Tunnel to expose your local OpenClaw webhook server.

## Why Cloudflare Tunnel?

- **Free**: No cost for personal use
- **Secure**: No need to open ports on your firewall
- **HTTPS**: Automatic SSL certificates
- **Reliable**: Auto-reconnect and crash recovery

## Prerequisites

- A Cloudflare account (free tier works)
- A domain added to Cloudflare (can be any cheap domain)
- OpenClaw with Lark plugin running on port 3000

## Installation

### 1. Install cloudflared

**Linux (ARM64):**
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /tmp/cloudflared
sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
```

**Linux (AMD64):**
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared
sudo mv /tmp/cloudflared /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
```

**macOS:**
```bash
brew install cloudflare/cloudflare/cloudflared
```

### 2. Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser window. Log in and authorize the domain you want to use.

### 3. Create a Named Tunnel

```bash
cloudflared tunnel create lark-webhook
```

This creates:
- Tunnel credentials at `~/.cloudflared/<TUNNEL_ID>.json`
- Certificate at `~/.cloudflared/cert.pem`

### 4. Configure the Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/<USER>/.cloudflared/<TUNNEL_ID>.json

ingress:
  - service: http://localhost:3000
```

Replace `<TUNNEL_ID>` with your actual tunnel ID and `<USER>` with your username.

### 5. Create DNS Route

```bash
cloudflared tunnel route dns lark-webhook lark.yourdomain.com
```

This creates a CNAME record pointing `lark.yourdomain.com` to your tunnel.

### 6. Test the Tunnel

```bash
cloudflared tunnel run lark-webhook
```

Test it:
```bash
curl https://lark.yourdomain.com/
# Should return "Method Not Allowed" (expected - webhook expects POST)
```

## Auto-Start on Boot (systemd)

Create `/etc/systemd/system/cloudflared.service`:

```ini
[Unit]
Description=Cloudflare Tunnel for Lark Webhook
After=network.target

[Service]
Type=simple
User=<YOUR_USERNAME>
ExecStart=/usr/local/bin/cloudflared tunnel run lark-webhook
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

## Configure Lark App

1. Go to [Lark Developer Console](https://open.larksuite.com/app)
2. Select your app
3. Go to **Event Subscriptions**
4. Set **Request URL** to: `https://lark.yourdomain.com`
5. Click **Save** (Lark will verify the endpoint)

## Verify Everything Works

1. Check tunnel status:
   ```bash
   systemctl status cloudflared
   ```

2. Check OpenClaw is listening:
   ```bash
   ss -tlnp | grep 3000
   ```

3. Test webhook verification:
   ```bash
   curl -X POST https://lark.yourdomain.com/ \
     -H "Content-Type: application/json" \
     -d '{"type":"url_verification","challenge":"test123"}'
   # Should return: {"challenge":"test123"}
   ```

4. Send a DM to your Lark bot - it should respond!

## Troubleshooting

**Tunnel not connecting:**
```bash
journalctl -u cloudflared -f
```

**Port 3000 not listening:**
- Make sure OpenClaw gateway is running
- Check: `openclaw gateway status`

**Lark verification fails:**
- Ensure the webhook URL is correct
- Check if tunnel is running
- Verify DNS has propagated: `dig lark.yourdomain.com`

## Quick Tunnel (Alternative)

For testing without a Cloudflare account, use a quick tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

This gives you a temporary URL like `https://random-words.trycloudflare.com`. 

⚠️ **Note**: Quick tunnel URLs change on every restart - not suitable for production.
