/* Experimental companion for Reze Boom. For source-built Vencord only. */
import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { SelectedChannelStore } from "@webpack/common";

import { LiquidPreview } from "./LiquidPreview";
import { LiveChannelAnchor, selectLiveNav, startLiveNav, stopLiveNav } from "./liveNav";

const settings = definePluginSettings({
    shaderPreview: {
        type: OptionType.COMPONENT,
        component: LiquidPreview
    },
    enableLiquidNav: {
        type: OptionType.BOOLEAN,
        description: "Experimental GPU highlight for selected server channels (requires restart; does not replace Discord controls)",
        default: false,
        restartNeeded: true
    }
});

export default definePlugin({
    name: "LiquidGlassFx",
    description: "Liquid-glass shader preview and optional experimental live server-channel highlight",
    // Discord snowflake not provided; this is intentionally not a guessed personal ID.
    authors: [{ name: "a1edail", id: 0n }],
    settings,
    // Verified upstream pattern: Vencord TypingIndicator injects into the guild
    // channel child array at UNREAD_IMPORTANT; no unbounded DOM observers.
    patches: [{
        find: "UNREAD_IMPORTANT:",
        replacement: {
            match: /\.Children\.count.+?:null(?<=,channel:(\i).+?)/,
            replace: "$&,$self.LiquidNavAnchor($1.id)"
        }
    }],
    LiquidNavAnchor: (channelId: string) => settings.store.enableLiquidNav
        ? <LiveChannelAnchor channelId={channelId} /> : null,
    flux: {
        CHANNEL_SELECT(event: { channelId?: string; }) {
            if (settings.store.enableLiquidNav) selectLiveNav(event.channelId);
        }
    },
    start() {
        if (settings.store.enableLiquidNav) startLiveNav(SelectedChannelStore.getChannelId());
    },
    stop() {
        stopLiveNav();
    }
});
