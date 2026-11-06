/* Experimental companion for Reze Boom. For source-built Vencord only. */
import "./styles.css";

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

import { LiquidPreview } from "./LiquidPreview";

const settings = definePluginSettings({
    shaderPreview: {
        type: OptionType.COMPONENT,
        component: LiquidPreview
    }
});

export default definePlugin({
    name: "LiquidGlassFx",
    description: "Experimental shader-rendered water glass in a safe settings preview (no live Discord UI patches)",
    // Discord snowflake not provided; this is intentionally not a guessed personal ID.
    authors: [{ name: "a1edail", id: 0n }],
    settings
});
