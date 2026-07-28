import { expect, test } from "@playwright/test";

async function waitForHydration(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => document.documentElement.dataset.hydrated === "true",
  );
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    class TestMediaRecorder {
      static isTypeSupported(type: string) {
        return type.startsWith("audio/");
      }
      state: RecordingState = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
        this.mimeType = options?.mimeType ?? "audio/webm";
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        const data = new Blob(["mock"], { type: this.mimeType });
        this.ondataavailable?.({ data } as BlobEvent);
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", {
      value: TestMediaRecorder,
      configurable: true,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async () => ({
          getTracks: () => [{ stop() {} }],
        }),
      },
      configurable: true,
    });
  });
});

test("opens dashboard, enters a lesson and uses playback text controls", async ({
  page,
}) => {
  await page.goto("/");
  await waitForHydration(page);
  await expect(
    page.getByRole("heading", { name: "今日も、声に出そう。" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /查看课程/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "お願いの仕方" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /听读练习/ }).click();
  await expect(
    page.getByText("すみません、ちょっとお願いがあるんですが。").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "日文 J" }).click();
  await expect(page.getByText("日文已隐藏 · 按 J 显示")).toBeVisible();
  await page.getByRole("button", { name: "翻译 T" }).click();
  await page.getByRole("button", { name: "播放音频" }).click();
});

test("completes a dictation and visits expression review", async ({ page }) => {
  await page.goto("/dictation/lesson-1");
  await waitForHydration(page);
  await page
    .getByLabel("你的答案")
    .fill("すみません、ちょっとお願いがあるんですが。");
  await page.getByRole("button", { name: "检查答案" }).click();
  await expect(page.getByText("完全正确！")).toBeVisible();
  await page.goto("/expressions");
  await waitForHydration(page);
  await expect(page.getByRole("heading", { name: "重要表达" })).toBeVisible();
  await page.getByRole("button", { name: /开始复习/ }).click();
  await page.getByRole("button", { name: "显示解释" }).click();
  await expect(page.getByRole("button", { name: /^认识/ })).toBeEnabled();
});

test("mobile layout exposes one-hand bottom navigation", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only assertion");
  await page.goto("/");
  await waitForHydration(page);
  await expect(
    page.getByRole("navigation", { name: "移动端主导航" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "课程" }).last().click();
  await expect(
    page.getByRole("heading", { name: "课程 · コース" }),
  ).toBeVisible();
});
