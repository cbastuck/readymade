import { createShortRandomString } from "hkp-frontend/src/views/playground/common";
import { capitaliseHeadline } from ".";
import { CarouselItem } from "..";

import { receive } from "./TextReceive";

const headline = "receive encrypted textfrom one a peer";

export const senderBoardUrl = `/playground/sender-${createShortRandomString()}?fromLink=N4KABGBEBOCuB2AXAlgWwKYGdIC4wG1wIxRjjJkATXKAdgGYAGAM0cfvQFp6BjHgVk4AWAEzN6nABwBOAIw9OANgCGy5j3TLKsxc1mQANETKR4yjDUgBlNcujJDx8ogCeAB3SWARtAD2Ad0x0aEcyCEhMRGVETzxgAF8neKMyUjCKajxIIX5mXWkvIU4eL0VBIVl0SU4tehEpMUppenpK1ulQ9LMLLKt0eEpgzpNXD28-QKGU9Mjo2JJEskWwAF1piOCAN2QNbDinSAYWNg5uPnKxCRl5JVV1TW1dfTxCMJInE1hYKkt0ITkhF5ZJQzopaMIATV0JRFFIeJIvF5pMpZIxUfRhjMtjt0ABJTJQAAWvl8AGtYG4AHSIXwAeiC0G2GlphMQqAANpiTAymegAHLmeaQAASbM50zekC8vjsBMggzc0HQPDmlDA0tl3XQYE4YAA5uhEGBkEbmH5UGBlG43FzyMxYOz2ZgeEr+jREHB0BL0jxfPBmMg9TQ0m9wjFUG52XNLAAeSjITZgHhRzCYAC8AHJmOz0AAPMDZvPFXzssBuXPCfVWzgiMD+Tj4SSMACkKzAqBqsBpGYAfDHCbIe30BmAYrnEDGWYOwDHkPA3F3jZRM25lC52TLKBmkyn0xnpdBBtAyzXt5HlBpieyj5mx0aaWAggNt5gPI6eITlaTM8xlE70BmtI9hAs7zouVCZkELqGtuybKKmmYHkeJ4iGeUaXiWN4ZlBSqIJwpLoC4L5vuyH5fj+f5BNumx-rA6CZjGzZpo+yq4WAzY9tufpeOysDQJmhKklSQSIH0jI4gAwn6AZ6gAFLIBiMAYJA4YaeCIISyCYJSNG8eg8QAJTbkBM5zguRoQRmSo8MgbjIP0iCwbuiG+IewQoWhF7oFeWHWbZ9lIJwHjBNRtH0RmjHMX5dkOexnFgNxvH8RmgnCYaYm8lJ-qBvJBgKSQUTQAaiAAAroME6madpul0YZxHoO+n48N+WaUQBYAmTGXhdjS8A7vBe5uDW6p6pwerQGuNZsGAxKbBVXijeNk2KGwXHwMmOwtallKKr4uyYHyeaILJSlgKdlB7bAGBIJSxUAKI5tdiAAEIuPiskADqQKu66bl9Bk6WFRlDv0lCTt1iC9X2tLxpsPa2iYG4qk6wYfKGGzQYgaaWMVGWSdJOX5ad2GsTBBkI+k0UBVjOPpdiGhZTJuVgPlGaFcVZUheTaNLDzYDJHzkCoL4gy-AAVtgaPLBAawHDkeTMAURQlGUwiVNUtT1JIjTNK06DtDQrxhCG6RfD8WT8MoMheNCghiDw9QVJUNQ6EU0jSOwMKyMw2syBTGziRo+KWMSZIUtSdI8jitL9C67iIP7UcaAKPRQHd63QPH-saoelgKtZqrqjKh5ajq+qGsaprmpa1qJ6TCdZP46BN-7GAaSLewEHz4TKFgkB87LoZQG3xJyr32DeiY8bWSgfq-BnWdS5P7xD5AZtyiUkjKIokg3PwjCKFwQg+7Ckj8JQRQHxU-C0PwJT8GUdeB3icqh+SVI0vS9PoLSwXQJwmA9oEQTsvcISd+SCksJzY8VggGGlbiLIUw41R+nZC4f2f8U5Cn9uzQ00DLD+yOhNHgiBcTrV8KgOceoAAi0RlA0F-P+UBUAvDuAGgwtqUsnArCIALMBVBlSEmUHOAASr4LsVDgx8KgOIxA5kxESPgEGOI0iKBgUQAolASipHrEGM6ewbhZ7wAIesC8GhDHQisC4dayDgid3wIPKASoxbKhiJQKxNjQZ2MNjw+IQA`;
export const send: CarouselItem = {
  boardUrl: senderBoardUrl,
  videoUrl: "/assets/teaser/TextSend2.mp4",
  headline,
  title: `Sample 3: ${capitaliseHeadline(headline)}`,
  description: (
    <div className="flex flex-col gap-2">
      <div>
        Sometimes I need to pass a password, or an access code from one device
        to another. Ideally, without taking a detour through the public
        internet.
      </div>
      <div>
        This video demonstrates two apps in fullscreen mode for exchanging text
        information. Start with the{" "}
        <a href={receive.boardUrl} target="_blank">
          receiver app
        </a>
        , give the receiver a name and specify a secret. On the other device,
        open the{" "}
        <a href={senderBoardUrl} target="_blank">
          sender app
        </a>{" "}
        and enter the same name and secret.
      </div>
    </div>
  ),
  action: {
    title: "Open in Playground",
    onClick: {
      url: receive.boardUrl,
    },
  },
  createdAt: "Jul 19, 2024",
};
