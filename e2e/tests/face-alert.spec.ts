import fs from "node:fs";
import type { Request } from "@playwright/test";
import { test, expect } from "../support/test";

/**
 * The Face Alert board as it ships: Chrome's fake camera plays a video, the
 * board finds faces in it with the bundled MediaPipe model, and a face that
 * appears is sent to ntfy — once, however long it stays in view. ntfy is
 * answered here, so nothing leaves the machine.
 *
 * The camera needs a video to play, and a picture of a person is not
 * something the repository keeps. The spec runs when HKP_E2E_FACE_Y4M names a
 * .y4m video with a face in it, e.g.
 * `ffmpeg -loop 1 -i portrait.jpg -t 2 -r 5 -vf "scale=640:800,format=yuv420p" face.y4m`.
 * (Chrome's fake camera is a launch option, which Playwright allows only for
 * a whole file — so one video, one file.)
 */

test.skip(({ profile }) => profile !== "web", "a browser-hosted pipeline");

const board = JSON.parse(
  fs.readFileSync(new URL("../../boards/face-alert-board.json", import.meta.url), "utf8"),
);

function cameraPlaying(video: string | undefined) {
  return {
    permissions: ["camera"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-video-capture=${video ?? ""}`,
      ],
    },
  };
}

/** Answers ntfy, and keeps what was sent to it. */
async function answerNtfy(page: import("@playwright/test").Page) {
  const sent: Request[] = [];
  await page.route("https://ntfy.sh/**", async (route) => {
    sent.push(route.request());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "e2e", event: "message" }),
    });
  });
  return sent;
}

const video = process.env.HKP_E2E_FACE_Y4M;
test.skip(!video, "HKP_E2E_FACE_Y4M names no video with a face in it");
test.use(cameraPlaying(video));

test.describe("with a face in view", () => {
  test("sends one notification when the face appears, not one per frame", async ({
    seedBoard,
    openBoard,
    page,
  }) => {
    const sent = await answerNtfy(page);
    await seedBoard("face-alert-e2e", board);
    await openBoard("face-alert-e2e");

    // The model loads from the app's own files, then the first frame with a
    // face in it is the one that is sent.
    await expect.poll(() => sent.length, { timeout: 30_000 }).toBe(1);
    const request = sent[0];
    expect(request.method()).toBe("POST");
    expect(request.url()).toBe("https://ntfy.sh/readymade-face-alert");
    expect(request.postData()).toBe("Someone is in front of the camera");
    expect(request.headers()["title"]).toBe("Face Alert");
    expect(request.headers()["priority"]).toBe("high");

    // The facade shows what Detect saw, the face outlined, rather than the
    // camera's own picture.
    // (The board view stays drawn behind the facade, service panels and all,
    // so what is the facade's is what sits outside a service's frame.)
    const facade = (selector: string) =>
      page.locator(`${selector}:not([id^="service-frame-"] *)`);
    await expect(facade('canvas[aria-label="1 face found"]')).toHaveCount(1);
    await expect(facade("video:visible")).toHaveCount(0);

    // And says how many.
    await expect(page.getByText("Faces in view:").locator("..")).toContainText(
      /Faces in view:\s*1/,
    );

    // The face stays; the frames keep coming; nothing more is sent.
    await page.waitForTimeout(4_000);
    expect(sent).toHaveLength(1);
  });
});
