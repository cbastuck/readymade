import { test, expect, chromium } from "@playwright/test";

/**
 * An environment check, not a product test: can two browser contexts in one
 * run establish a WebRTC data channel and exchange a message?
 *
 * This is what the peer-chat specs stand on, so it is worth failing here — in
 * twenty lines of plain WebRTC — rather than inside a board. It uses no HKP
 * code and no signalling server: the test process passes the SDP between the
 * two pages, so a failure is about the browser and the machine, not the app.
 *
 * `--disable-features=WebRtcHideLocalIpsWithMdns` is load-bearing. Chrome
 * replaces host candidates with `.local` mDNS names that two isolated contexts
 * cannot resolve for each other, and without the flag pairing simply never
 * completes — no error, just a channel that stays closed. With it, and with no
 * STUN configured at all, pairing takes well under a second, which is what
 * makes this viable on a CI runner with no outbound UDP.
 */
test("two contexts can open a WebRTC data channel", async () => {
  const browser = await chromium.launch({
    args: ["--disable-features=WebRtcHideLocalIpsWithMdns"],
  });
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pageA = await a.newPage();
  const pageB = await b.newPage();
  await pageA.goto("about:blank");
  await pageB.goto("about:blank");

  const setup = async (page: typeof pageA, isOfferer: boolean) =>
    page.evaluate((offerer) => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      (window as any).__pc = pc;
      (window as any).__received = new Promise<string>((resolve) => {
        if (offerer) {
          const channel = pc.createDataChannel("probe");
          (window as any).__channel = channel;
          channel.onmessage = (event) => resolve(String(event.data));
        } else {
          pc.ondatachannel = (event) => {
            (window as any).__channel = event.channel;
            event.channel.onmessage = (message) =>
              resolve(String(message.data));
          };
        }
      });
    }, isOfferer);

  await setup(pageA, true);
  await setup(pageB, false);

  // Non-trickle: wait for gathering to finish so one SDP carries everything.
  const localDescription = (page: typeof pageA, kind: "offer" | "answer") =>
    page.evaluate(async (which) => {
      const pc = (window as any).__pc as RTCPeerConnection;
      const description =
        which === "offer" ? await pc.createOffer() : await pc.createAnswer();
      await pc.setLocalDescription(description);
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
          return;
        }
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          }
        };
      });
      return JSON.stringify(pc.localDescription);
    }, kind);

  const setRemote = (page: typeof pageA, sdp: string) =>
    page.evaluate(async (raw) => {
      const pc = (window as any).__pc as RTCPeerConnection;
      await pc.setRemoteDescription(JSON.parse(raw));
    }, sdp);

  const offer = await localDescription(pageA, "offer");
  await setRemote(pageB, offer);
  const answer = await localDescription(pageB, "answer");
  await setRemote(pageA, answer);

  const opened = await pageA.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const channel = (window as any).__channel as RTCDataChannel;
        if (channel.readyState === "open") {
          resolve(true);
          return;
        }
        channel.onopen = () => resolve(true);
        setTimeout(() => resolve(false), 15000);
      }),
  );
  expect(opened, "data channel opened on host candidates alone").toBe(true);

  await pageA.evaluate(() =>
    ((window as any).__channel as RTCDataChannel).send("hello from A"),
  );
  await expect
    .poll(() => pageB.evaluate(() => (window as any).__received), {
      timeout: 15000,
    })
    .toBe("hello from A");

  await browser.close();
});
