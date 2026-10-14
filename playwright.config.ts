import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"./tests/e2e",
  fullyParallel:true,
  workers:2,
  timeout:30000,
  use:{baseURL:"http://127.0.0.1:3000",headless:true,launchOptions:process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH}:{}},
  webServer:{command:"npm run start",url:"http://127.0.0.1:3000",reuseExistingServer:false,timeout:60000},
  reporter:[["list"],["html",{open:"never"}]],
});
