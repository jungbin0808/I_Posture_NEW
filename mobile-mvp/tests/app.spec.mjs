import { test, expect } from "@playwright/test";
async function ready(page) {
  await expect(page.locator(".camera")).toHaveAttribute("data-ready", "true", {
    timeout: 60000,
  });
}
test("inbody survives reload and can be deleted", async ({ page }) => {
  await page.goto("/");
  await page.locator(".feature-inbody").click();
  await page.getByLabel("체중 (kg)").fill("68.5");
  await page
    .getByRole("button", { name: "인바디 기록 저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "나의 인바디 기록", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /기록$/ })
    .click();
  await page.getByRole("button", { name: /나의 인바디 기록/ }).click();
  await expect(page.getByText("68.5", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "이 기록 삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제하기", exact: true }).click();
  await expect(
    page.getByText("변화의 시작을 기록해 보세요", { exact: true }),
  ).toBeVisible();
});
test("camera draws real inferred joints and moves front/right/back on one stream", async ({
  page,
}) => {
  test.skip(!process.env.CAMERA_FIXTURE, "Set a camera Y4M fixture.");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "측정 시작하기 →", exact: true })
    .click();
  await expect(page.locator(".feature")).toHaveCount(3);
  await page.locator(".feature-body").click();
  await ready(page);
  const first = await page
    .locator('video[aria-label="실시간 카메라"]')
    .evaluate((v) => {
      window.tracks = v.srcObject.getTracks();
      return window.tracks.map((t) => t.id);
    });
  expect(
    await page
      .locator('canvas[aria-label="실시간 관절점과 연결선"]')
      .evaluate((c) =>
        c
          .getContext("2d")
          .getImageData(0, 0, c.width, c.height)
          .data.some((v, i) => i % 4 === 3 && v > 0),
      ),
  ).toBe(true);
  await page.getByLabel("촬영 타이머").selectOption("0");
  for (const name of ["정면", "우측면", "후면"]) {
    await expect(
      page.getByRole("heading", { name: name + " 촬영", exact: true }),
    ).toBeVisible();
    await ready(page);
    expect(
      await page
        .locator('video[aria-label="실시간 카메라"]')
        .evaluate((v) => v.srcObject.getTracks().map((t) => t.id)),
    ).toEqual(first);
    await page
      .getByRole("button", { name: name + " 촬영", exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "촬영 확인", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".pose-photo")).toHaveCount(3);
  expect(
    await page.evaluate(() =>
      window.tracks.every((t) => t.readyState === "ended"),
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "측정 결과 확인하고 저장 →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "나의 체형측정", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("precision supports mirror switch and two live snapshots", async ({
  page,
}) => {
  test.skip(!process.env.CAMERA_FIXTURE, "Set a camera Y4M fixture.");
  await page.goto("/");
  await page.locator(".feature-precision").click();
  await page
    .getByRole("button", { name: "정밀측정 촬영 시작 →", exact: true })
    .click();
  await ready(page);
  await page.getByRole("button", { name: "카메라 전환", exact: true }).click();
  await ready(page);
  expect(
    await page
      .locator(".camera-frame video")
      .evaluate((v) => getComputedStyle(v).transform),
  ).toBe(
    await page
      .locator(".camera-frame canvas")
      .evaluate((v) => getComputedStyle(v).transform),
  );
  await page.getByLabel("촬영 타이머").selectOption("0");
  await page
    .getByRole("button", { name: "시작 자세 촬영", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "움직인 자세 촬영", exact: true }),
  ).toBeVisible();
  await ready(page);
  await page
    .getByRole("button", { name: "움직인 자세 촬영", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "촬영 확인", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "측정 결과 확인하고 저장 →", exact: true })
    .click();
  await expect(page.locator(".angle-result")).toBeVisible();
});
test("live recording has finite duration and observed joint frames", async ({
  page,
}) => {
  test.skip(!process.env.CAMERA_FIXTURE, "Set a camera Y4M fixture.");
  await page.goto("/");
  await page.locator(".feature-motion").click();
  await page
    .getByRole("button", { name: "모션 촬영 시작 →", exact: true })
    .click();
  await ready(page);
  await page.getByLabel("촬영 타이머").selectOption("0");
  await page.getByRole("button", { name: "녹화 시작", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "녹화 종료", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: "녹화 종료", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "모션 분석 확인", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await expect(page.locator(".chart circle")).not.toHaveCount(0);
  await page
    .getByRole("button", { name: "영상과 분석 기록 저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "나의 움직임", exact: true }),
  ).toBeVisible();
});

test("saved measurement opens report, compares previous record and prints", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("iposture-rebuilt", 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("records", "readwrite");
        const s = tx.objectStore("records");
        s.put({
          id: "older",
          date: "2026-11-16T01:00:00Z",
          kind: "precision",
          title: "왼쪽 팔꿈치 굽힘",
          data: { key: "ElbowLeftFlexion", angle: 80 },
          media: [],
        });
        s.put({
          id: "current",
          date: "2026-11-17T01:00:00Z",
          kind: "precision",
          title: "왼쪽 팔꿈치 굽힘",
          data: { key: "ElbowLeftFlexion", angle: 90 },
          media: [],
        });
        s.put({
          id: "missing",
          date: "2026-11-17T02:00:00Z",
          kind: "precision",
          title: "관절 부족 측정",
          data: {
            key: "ElbowLeftFlexion",
            angle: null,
            reason: "필요 관절 미인식",
          },
          media: [],
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = reject;
      };
      request.onerror = reject;
    });
    window.print = () => {
      window.printCalled = true;
    };
  });
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /리포트$/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "나의 측정 리포트" }),
  ).toBeVisible();
  await expect(page.locator(".report-table")).toContainText("측정 불가");
  await page.getByLabel("리포트에 표시할 기록").selectOption("current");
  await expect(page.locator(".report-table")).toContainText("+10°");
  await page.evaluate(() => {
    window.print = () => {
      window.printCalled = true;
    };
  });
  await page.getByRole("button", { name: "PDF 저장 / 인쇄" }).click();
  await expect.poll(() => page.evaluate(() => !!window.printCalled)).toBe(true);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation")).toBeHidden();
  await expect(page.locator(".report-table")).toBeVisible();
  await page.pdf({
    path: "test-results/measurement-report.pdf",
    format: "A4",
    printBackground: true,
  });
});

test("no-joints camera still captures all body views and saves an unmeasured report", async ({
  page,
}) => {
  test.skip(!process.env.EMPTY_CAMERA, "Run with a blank Y4M camera fixture.");
  await page.goto("/");
  await page.locator(".feature-body").click();
  await ready(page);
  await page.getByLabel("촬영 타이머").selectOption("0");
  await expect(page.locator(".quality")).toContainText("미인식");
  for (const name of ["정면", "우측면", "후면"]) {
    await ready(page);
    await page
      .getByRole("button", { name: name + " 촬영", exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "촬영 확인", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "측정 결과 확인하고 저장 →", exact: true })
    .click();
  await expect(page.locator(".metrics")).toContainText("측정 불가");
  await page.getByRole("button", { name: "측정 리포트 보기 →" }).click();
  await expect(page.locator(".report-heading")).toContainText(
    "계산 가능 0/6항목",
  );
  await expect(page.locator(".report-media .pose-photo")).toHaveCount(3);
  await page.screenshot({
    path: "test-results/partial-measurement-report.png",
    fullPage: true,
  });
  await page.pdf({
    path: "test-results/partial-measurement-report.pdf",
    format: "A4",
    printBackground: true,
  });
});

test("no-joints precision and motion also save without requiring detected joints", async ({
  page,
}) => {
  test.skip(!process.env.EMPTY_CAMERA, "Run with a blank Y4M camera fixture.");
  await page.goto("/");
  await page.locator(".feature-precision").click();
  await page
    .getByRole("button", { name: "정밀측정 촬영 시작 →", exact: true })
    .click();
  await ready(page);
  await page.getByLabel("촬영 타이머").selectOption("0");
  for (const name of ["시작 자세", "움직인 자세"]) {
    await ready(page);
    await page
      .getByRole("button", { name: name + " 촬영", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "측정 결과 확인하고 저장 →", exact: true })
    .click();
  await expect(page.locator(".angle-result")).toContainText("측정 불가");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /홈$/ })
    .click();
  await page.locator(".feature-motion").click();
  await page
    .getByRole("button", { name: "모션 촬영 시작 →", exact: true })
    .click();
  await ready(page);
  await page.getByLabel("촬영 타이머").selectOption("0");
  await page.getByRole("button", { name: "녹화 시작", exact: true }).click();
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: "녹화 종료", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "모션 분석 확인", exact: true }),
  ).toBeVisible({ timeout: 90000 });
  await expect(page.locator(".chart circle")).toHaveCount(0);
  await page
    .getByRole("button", { name: "영상과 분석 기록 저장", exact: true })
    .click();
  await page.getByRole("button", { name: "측정 리포트 보기 →" }).click();
  await expect(page.locator(".report-heading")).toContainText(
    "계산 가능 0/12항목",
  );
});
