import { defineCustomElement } from "vue";
import { definePluginContext } from "@ciderapp/pluginkit";
import MySettings from "./components/MySettings.vue";
import PluginConfig from "./plugin.config";
import { startIntercept, stopIntercept } from "./lyrics/intercept";
import { startPanel, stopPanel } from "./ui/panel";

/** Custom elements registered in the host. */
export const CustomElements = {
  settings: defineCustomElement(MySettings, { shadowRoot: false }),
};

const { plugin, setupConfig, customElementName, goToPage, useCPlugin } = definePluginContext({
  ...PluginConfig,
  CustomElements,
  setup() {
    for (const [key, value] of Object.entries(CustomElements)) {
      const name = customElementName(key as keyof typeof CustomElements);
      if (!customElements.get(name)) customElements.define(name, value);
    }
    this.SettingsElement = customElementName("settings");

    startIntercept();
    startPanel();
    window.addEventListener(
      "beforeunload",
      () => {
        stopIntercept();
        stopPanel();
      },
      { once: true },
    );
  },
});

export { setupConfig, customElementName, goToPage, useCPlugin };

/** Cider loads the plugin through this export. */
export default plugin;
