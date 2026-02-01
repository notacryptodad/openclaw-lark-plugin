/**
 * OpenClaw Lark Plugin
 *
 * Implements the ChannelPlugin interface for Lark/Feishu integration.
 * Provides account configuration, message sending, and gateway management.
 * 
 * Inspired by and adapted from:
 * https://github.com/sugarforever/moltbot-warehouse
 * Original plugin by @sugarforever
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

import { larkChannelPlugin } from "./src/channel.js";
import { setLarkRuntime } from "./src/runtime.js";
import { monitorLarkProvider } from "./src/monitor.js";

/**
 * Lark plugin manifest and registration.
 * Registers the channel plugin and starts background monitoring.
 */
export default {
  id: "lark",
  name: "Lark",
  version: "0.0.1",
  description: "Lark (Larksuite) channel plugin for OpenClaw",
  configSchema: emptyPluginConfigSchema,
  register(api: OpenClawPluginApi) {
    setLarkRuntime(api);

    api.logger.info("[lark] Plugin registered");

    // Register the channel plugin
    api.registerChannel(larkChannelPlugin);

    // Start background provider monitoring
    monitorLarkProvider(api.config).catch((err) => {
      api.logger.error(`[lark] Provider monitor failed: ${err}`);
    });
  },
};
