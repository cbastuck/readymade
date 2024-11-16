import { capitaliseHeadline } from ".";
import { CarouselItem } from "..";

const headline = "test an idea for a midi controller and directly play it";

const boardUrl = `/playground/midi-controller?fromLink=N4IgTgrgdgLglgWwKYGcQC4Dao4BMMgAcAhgGwAMALEsYQLQCcNA7HZQEYBm9x5AjHzp9CSJAGNKAJnKl2hBiAA0IKMWQEAwgAswAe3XKYATwAOSAuz0B3FEjBKQKGMRjn0oK2GImAynYBucGKoGDCQSMoIcFCIcABeSPjonMQANrYAvhkAusq2YIHBaO5EZFQ09EzErBzcdLwCQiLiUjJyCligEBB4BORy5OQArJxDdLhiw2wMnOT1QwDMuOOUCwuS7MySnLhD+HkBQUgAkkkgWrq6ANYQJgB0MLoA9PmFSE8AHkZ0JsT7jodggA5NRuEAADQAmg4AOZgPAAJV0NgwzGUcLwGl06VRynYpmIKGKKXSSAyii6PTODA27AYhDqpHkgkozGIlDo7GInEkdFIfCGsgWDL4TKGDleR1OBAu11uD2ekuCTzMdjoKF0YiuSBgEsBSBB6nQIAACqIwAACHya7W6yK6XBghHiJBwfxIC26KCpIwOVVgQ1gyR8LikSiC8ZIYRsZhDVgMXC4QTskNiSQLJmEYYOJAfMLEMQwY5QMT6aIwgAiLmIoXCeIJRNrEDJFJA3V6xrplD4nDEC3YdAWlAYpDYezGxGFo8T7HIYiGSHDzFWeoKUrOspu90eL31L2cWtXb0DBB8B6uDnYumIYDOjpMYHELkSFqvN9wqmQFroFphOotcAwBanB6AgFreCYDjRCYEC6saCAQKk8AmKkuYOLosEwXBIA3l4voHGuRQYNgAKEQaoIEAAst4R7rjKlxbgqu5kU8CA0eSoBKuRRogNRkEEW80rGpu8o7lxrHsbkjgQOwXHFCR7ZnIQuCSEghB8MQYwMIMA7Drgo4zBQdCjBsNAyJQ-DMJe163gQ96PmIz64K+NkfqC36-v+gHAaB4EmPxICOigYjwiYjz2CUXEnsafG0cEQnnAxomKnubGQeSjjOK4GCgAgDpgo+KEFuYhhIAgRXZSUUC6K4AC8BAABSYKQDCKBazB8G1WxdZQXWkF1aLtQw2QAJSYL8XgICgdzWNkDjGGY9XGhNajTUg7qwAAKqYJUgCYgFiFoABCSBQLgS17Teq13Otp0wNtZgWrVz0WgA5Hl7qvRaABk30Wg1K1TXcHwWgAVBakjfnwI1gxaYYgFk9a-I2yRpLYAlHNFvE0Rj8Ubkl24pSxaUI62ikEGGnBDnwYgDn8bLTMwA4MHwwrGewojECODByKQNZ4q5dlIA+T6uM5b63p+Ho-n+QHeSB+h+QFQUhXAYW6BFnH6ljsW4yc+NyoTzFvBJ6V5Flbi5flBCFakxXzWVFWWyoNVIBdTUtV1nXtZIPV9QNXXDWNgPTaWqQQAgUBzYYO0XSHN0bfdO1+gdx2nedBDx7dW07U9L3vbon0-X9ANXUDIPg5DQgw+D8OIyA+LI8SaMRKRx4UTFONt3RwkE0x4kkzkHFtlSBAMEMXKjOydDkAwDDEGwuCEMzCzT8I1SLKzFBxnF+v0Yb-epXgcB0BhMBYbvOvH3QADymGwXqqGFokd-nw-xoADK6DCQQWiaegWgAGpwDADACAaQLTFkvA2ZupIh4ZCAA`;

export const midi: CarouselItem = {
  boardUrl,
  videoUrl: "/assets/teaser/MidiController2.mp4",
  scale: "93%",
  headline,
  title: `Sample 4: ${capitaliseHeadline(headline)}`,
  description: (
    <div className="flex flex-col gap-4">
      <div>
        The example uses a local XY Pad configured with seven rows and columns.
        Based on the row and column of the touch or press event on the pad, two
        MIDI notes from the a-minor scale are generated and sent to a MIDI
        output service. The MIDI output service transmits the notes as to the
        configured MIDI port; in this case it's Logic's virtual MIDI input port.
      </div>

      <div>
        The two mapping services in the stack translate click, touch, and move
        events into MIDI note numbers from the a-minor scale [69, 71, 72, 74,
        76, 77, 79], which correspond to the notes [A4, B4, C5, D5, E5, F5, G5].
      </div>
      <div>
        Playing with a touchpad or mouse can be cumbersome. For this reason, a
        PeerSocket is placed after the pad and disabled by default. Connecting
        an XY Pad on a touch device to the PeerSocket provides a much better
        experience.
      </div>
    </div>
  ),
  action: {
    title: "Open in Playground (Chrome only)",
    onClick: {
      url: boardUrl,
    },
  },
  createdAt: "Aug 23, 2024",
};
