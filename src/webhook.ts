/**
 * Lark Webhook Server
 *
 * Standalone HTTP server for receiving Lark webhook callbacks.
 * Used for individual accounts that don't support WebSocket.
 * Includes automatic crash recovery.
 * 
 * Inspired by and adapted from:
 * https://github.com/sugarforever/moltbot-warehouse
 */

import * as http from "node:http";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { getLarkRuntime } from "./runtime.js";
import type { ResolvedLarkAccount, LarkMessageEvent } from "./types.js";

const DEFAULT_PORT = 3000;
const RESTART_DELAY_MS = 3000;
const MAX_RESTART_ATTEMPTS = 5;
const IMAGE_CACHE_DIR = path.join(os.tmpdir(), "lark-images");

interface WebhookServer {
  server: http.Server | null;
  port: number;
  stop: () => void;
}

// Ensure image cache directory exists
function ensureImageCacheDir(): void {
  if (!fs.existsSync(IMAGE_CACHE_DIR)) {
    fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
  }
}

/**
 * Decrypt AES-256-CBC encrypted event data from Lark.
 */
function decryptEvent(encrypted: string, encryptKey: string): string {
  const key = crypto.createHash("sha256").update(encryptKey).digest();
  const encryptedBuffer = Buffer.from(encrypted, "base64");
  const iv = encryptedBuffer.subarray(0, 16);
  const ciphertext = encryptedBuffer.subarray(16);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(ciphertext, undefined, "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Parse request body as JSON.
 */
async function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Download image from Lark and save to temp file.
 * Returns the local file path or null if download fails.
 */
async function downloadImage(
  imageKey: string,
  messageId: string,
  account: ResolvedLarkAccount
): Promise<string | null> {
  const api = getLarkRuntime();
  
  try {
    ensureImageCacheDir();
    
    const { createLarkClient } = await import("./client.js");
    const client = createLarkClient(account);
    
    // Download image from Lark
    const response = await client.im.image.get({
      path: {
        image_key: imageKey,
      },
    });
    
    // Get the readable stream from response
    const stream = response.getReadableStream?.() || (response as any).data;
    
    if (!stream) {
      api.logger.error(`[lark-webhook] No stream returned for image ${imageKey}`);
      return null;
    }
    
    // Generate unique filename
    const ext = ".png"; // Lark images are typically PNG
    const filename = `${messageId}_${imageKey}${ext}`;
    const filepath = path.join(IMAGE_CACHE_DIR, filename);
    
    // Write stream to file
    const writeStream = fs.createWriteStream(filepath);
    
    await new Promise<void>((resolve, reject) => {
      stream.pipe(writeStream);
      stream.on("error", reject);
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });
    
    api.logger.info(`[lark-webhook] Downloaded image to ${filepath}`);
    return filepath;
    
  } catch (err) {
    api.logger.error(`[lark-webhook] Failed to download image ${imageKey}: ${err}`);
    return null;
  }
}

/**
 * Extract content from Lark message.
 * Returns { text, images } where images is an array of local file paths.
 */
async function extractContent(
  content: string,
  messageType: string,
  messageId: string,
  account: ResolvedLarkAccount
): Promise<{ text: string; images: string[] }> {
  const api = getLarkRuntime();
  const images: string[] = [];
  
  try {
    const parsed = JSON.parse(content);
    
    // Handle text messages
    if (messageType === "text") {
      return { text: parsed.text ?? "", images };
    }
    
    // Handle image messages
    if (messageType === "image") {
      const imageKey = parsed.image_key;
      if (imageKey) {
        api.logger.info(`[lark-webhook] Received image: ${imageKey}`);
        const localPath = await downloadImage(imageKey, messageId, account);
        if (localPath) {
          images.push(localPath);
        }
      }
      return { text: "", images };
    }
    
    // Handle rich text (post) messages - may contain images
    if (messageType === "post") {
      const textParts: string[] = [];
      
      if (Array.isArray(parsed.content)) {
        for (const line of parsed.content.flat()) {
          if (line.tag === "text") {
            textParts.push(line.text || "");
          } else if (line.tag === "img" && line.image_key) {
            api.logger.info(`[lark-webhook] Received inline image: ${line.image_key}`);
            const localPath = await downloadImage(line.image_key, messageId, account);
            if (localPath) {
              images.push(localPath);
            }
          }
        }
      }
      
      return { 
        text: textParts.join("") || parsed.title || "", 
        images 
      };
    }
    
    // Handle file messages
    if (messageType === "file") {
      return { text: `[file: ${parsed.file_name || "attachment"}]`, images };
    }
    
    // Handle audio messages
    if (messageType === "audio") {
      return { text: "[voice message]", images };
    }
    
    // Handle video messages
    if (messageType === "media") {
      return { text: `[video: ${parsed.file_name || "video"}]`, images };
    }
    
    // Handle sticker messages
    if (messageType === "sticker") {
      return { text: "[sticker]", images };
    }
    
    // Handle share messages (cards, links)
    if (messageType === "share_chat" || messageType === "share_user") {
      return { text: "[shared content]", images };
    }
    
    // Unknown message type
    return { text: `[${messageType} message]`, images };
    
  } catch (err) {
    api.logger.error(`[lark-webhook] Failed to parse content: ${err}`);
    return { text: content, images };
  }
}

/**
 * Route incoming message to OpenClaw handler.
 */
async function routeMessage(
  event: LarkMessageEvent,
  account: ResolvedLarkAccount
): Promise<void> {
  const api = getLarkRuntime();
  const core = api.runtime;
  const cfg = api.config;
  const { message, sender } = event;
  
  // Extract content including images
  const { text, images } = await extractContent(
    message.content, 
    message.message_type,
    message.message_id,
    account
  );

  // Skip if no text and no images
  if (!text.trim() && images.length === 0) {
    return;
  }

  const senderId = sender.sender_id.open_id;
  const chatId = message.chat_id;
  const isGroup = message.chat_type === "group";

  api.logger.info(
    `[lark-webhook] Message from ${senderId} in ${message.chat_type} ${chatId}` +
    (images.length > 0 ? ` with ${images.length} image(s)` : "")
  );

  // Build Lark-specific identifiers
  const larkFrom = `lark:${account.accountId}:${senderId}`;
  const larkTo = `lark:${account.accountId}:${chatId}`;

  // Resolve routing to find the agent
  const route = await core.channel.routing.resolveAgentRoute({
    cfg,
    channel: "lark",
    accountId: account.accountId,
    chatType: isGroup ? "group" : "direct",
    chatId,
    senderId,
  });

  if (!route) {
    api.logger.warn("[lark-webhook] No route found for message");
    return;
  }

  // Build the message body - include image description if present
  let body = text;
  if (images.length > 0 && !text.trim()) {
    body = "[User sent an image]";
  }

  // Finalize inbound context
  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    RawBody: body,
    CommandBody: body,
    From: larkFrom,
    To: larkTo,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: isGroup ? "group" : "direct",
    GroupSubject: isGroup ? chatId : undefined,
    SenderName: senderId,
    SenderId: senderId,
    Provider: "lark",
    Surface: "lark",
    MessageSid: message.message_id,
    Timestamp: Date.now(),
    WasMentioned: false,
    CommandAuthorized: true,
    OriginatingChannel: "lark",
    OriginatingTo: larkTo,
    // Attach images if present
    ...(images.length > 0 && { Attachments: images.map(p => ({ path: p, type: "image" })) }),
  });

  // Create a dispatcher that sends replies back to Lark
  const { createLarkClient } = await import("./client.js");
  const client = createLarkClient(account);
  const receiveIdType = chatId.startsWith("oc_") ? "chat_id" : "open_id";

  const dispatcher = {
    async sendBlockReply(block: Record<string, unknown>) {
      // Handle image/media
      const imagePath = (block.mediaUrl || block.media || block.image) as string | undefined;
      if (imagePath && fs.existsSync(imagePath)) {
        try {
          // Upload image to Lark
          const uploadResp = await client.im.image.create({
            data: {
              image_type: "message",
              image: fs.createReadStream(imagePath),
            },
          });

          // Handle both response formats
          const imageKey = (uploadResp as any).image_key || uploadResp.data?.image_key;

          if (imageKey) {
            await client.im.message.create({
              params: { receive_id_type: receiveIdType },
              data: {
                receive_id: chatId,
                msg_type: "image",
                content: JSON.stringify({ image_key: imageKey }),
              },
            });
            return;
          } else {
            api.logger.error(`[lark-webhook] Image upload failed: ${JSON.stringify(uploadResp)}`);
          }
        } catch (err) {
          api.logger.error(`[lark-webhook] Image upload error: ${err}`);
        }
      }

      // Handle text
      const replyText = (block.markdown || block.text || "") as string;
      if (!replyText.trim()) return;

      await client.im.message.create({
        params: { receive_id_type: receiveIdType },
        data: {
          receive_id: chatId,
          msg_type: "text",
          content: JSON.stringify({ text: replyText }),
        },
      });
    },
    async sendFinalReply(block: Record<string, unknown>) {
      // Final reply uses the same logic as block reply for Lark
      await dispatcher.sendBlockReply(block);
    },
    async waitForIdle() {
      // No buffering, messages sent immediately
    },
    getQueuedCounts() {
      return { blocks: 0, chars: 0 };
    },
  };

  // Dispatch the message to the agent
  await core.channel.reply.dispatchReplyFromConfig({
    ctx: ctxPayload,
    cfg,
    dispatcher,
    replyOptions: {
      agentId: route.agentId,
      channel: "lark",
      accountId: account.accountId,
    },
  });
}

/**
 * Handle incoming webhook request.
 */
async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  account: ResolvedLarkAccount
): Promise<void> {
  const api = getLarkRuntime();

  // Only accept POST requests
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end("Method Not Allowed");
    return;
  }

  try {
    let body = (await parseBody(req)) as Record<string, unknown>;

    // Handle encrypted events
    if (body.encrypt && account.encryptKey) {
      const decrypted = decryptEvent(body.encrypt as string, account.encryptKey);
      body = JSON.parse(decrypted);
    }

    // URL verification challenge
    if (body.type === "url_verification") {
      api.logger.info("[lark-webhook] URL verification received");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ challenge: body.challenge }));
      return;
    }

    // Handle event callback
    if (body.header && body.event) {
      const header = body.header as { event_type: string };
      const event = body.event as LarkMessageEvent;

      if (header.event_type === "im.message.receive_v1") {
        // Process message asynchronously to not block webhook response
        routeMessage(event, account).catch((err) => {
          api.logger.error(`[lark-webhook] Message routing error: ${err}`);
        });
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: 0 }));
      return;
    }

    // Unknown request format
    res.writeHead(200);
    res.end("OK");
  } catch (error) {
    api.logger.error(`[lark-webhook] Request error: ${error}`);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
}

/**
 * Start the webhook server with automatic crash recovery.
 */
export function startWebhookServer(
  account: ResolvedLarkAccount,
  port: number = DEFAULT_PORT
): WebhookServer {
  const api = getLarkRuntime();
  let server: http.Server | null = null;
  let restartAttempts = 0;
  let stopped = false;

  // Ensure image cache directory exists on startup
  ensureImageCacheDir();

  function createServer(): http.Server {
    const srv = http.createServer((req, res) => {
      handleRequest(req, res, account).catch((err) => {
        api.logger.error(`[lark-webhook] Unhandled error: ${err}`);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end("Internal Server Error");
        }
      });
    });

    srv.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        api.logger.error(`[lark-webhook] Port ${port} already in use`);
        return;
      }
      api.logger.error(`[lark-webhook] Server error: ${err.message}`);
      scheduleRestart();
    });

    srv.on("close", () => {
      if (!stopped) {
        api.logger.warn("[lark-webhook] Server closed unexpectedly");
        scheduleRestart();
      }
    });

    return srv;
  }

  function scheduleRestart() {
    if (stopped) return;

    restartAttempts++;
    if (restartAttempts > MAX_RESTART_ATTEMPTS) {
      api.logger.error(
        `[lark-webhook] Max restart attempts (${MAX_RESTART_ATTEMPTS}) exceeded, giving up`
      );
      return;
    }

    api.logger.info(
      `[lark-webhook] Restarting in ${RESTART_DELAY_MS}ms (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})`
    );

    setTimeout(() => {
      if (stopped) return;
      try {
        server = createServer();
        server.listen(port, () => {
          api.logger.info(`[lark-webhook] Server restarted on port ${port}`);
          restartAttempts = 0; // Reset on successful restart
        });
      } catch (err) {
        api.logger.error(`[lark-webhook] Restart failed: ${err}`);
        scheduleRestart();
      }
    }, RESTART_DELAY_MS);
  }

  // Initial server start
  server = createServer();
  server.listen(port, () => {
    api.logger.info(`[lark-webhook] Server listening on port ${port}`);
  });

  return {
    get server() {
      return server;
    },
    port,
    stop: () => {
      stopped = true;
      if (server) {
        server.close();
        server = null;
      }
      api.logger.info("[lark-webhook] Server stopped");
    },
  };
}
