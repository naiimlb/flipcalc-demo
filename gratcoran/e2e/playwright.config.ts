import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 90_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://grat-coran.vercel.app",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "off",
  },
  projects: [
    // Moteur de Safari, iPhone émulé : parcours compte / session / historique.
    { name: "webkit-iphone", use: { ...devices["iPhone 13"] } },
    // Chromium avec micro simulé : parcours d'enregistrement.
    {
      name: "chromium-mic",
      use: {
        ...devices["Pixel 7"],
        permissions: ["microphone"],
        launchOptions: {
          args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        },
      },
    },
  ],
});
