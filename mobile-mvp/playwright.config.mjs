import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  timeout: 120000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 390, height: 844 },
    permissions: ["camera"],
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        ...(process.env.CAMERA_FIXTURE
          ? ["--use-file-for-fake-video-capture=" + process.env.CAMERA_FIXTURE]
          : []),
      ],
    },
  },
  webServer: {
    command: "npm run preview -- --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
});
