import { CarouselItem } from "@/ui-components/Carousel";
import { createShortRandomString } from "@/views/playground/common";
import { capitaliseHeadline } from ".";

const headline = "send encrypted text data from one peer to another";

const boardUrl = `/playground/sender-${createShortRandomString()}?fromLink=N4IgTgrgdgLglgWwKYGcQC4Dao4BMMgDsAzAAwBmppxSAtMQMYMCstALAEznG0AcAnAEYGtAGwBDceQZJxuQaPKCQAGhBRxyAgGUp4sHFUgYATwAOSAgCMwAewDuKJGCMoY4mJfTAAvj5U4+OggbMzkivxWbLQMVqKsbIJIvLRyxBx8XLj8xMRJefxGGlrB2khQuM5GphbWdo5Vam4eXr4+ALpNzgBucDJo3kRklNR0jCzsXDwCwmKS0rLyispYoBAQeARIbEJsVoK49AyihOy7qUi4onwMvFZW-OKCpM-Erj19SACSQSAAFrZbABrCBmAB0MFsAHonGBejIoX8YAgADbvOGfABymi8IAAEsi0WorLZ9L9KmYwEgGC1cAACElk4pIOm0OkAcyQMDpcG55DsCDp4jMZiM5AgKJRKAYVPKGBgkCQagYtig5Dg7IwoE8CDMKJaBAAPLg4N06Qx9SgUABeADk5BRSAAHnSHc6YrYUXSzE72BzhbQOHT7LRMLxSABSdp0hCpCCQ20APkNf0EibKFTpnidMENiLTdMNcCgZnjPNwdrM4hMKNJuFt5stNttJLAlTA3sDDb14hkAJR7bt2e5kLpTgqDZQFklDD+1KBdvI4ilSFtUMTdMLxdL3LwdqcMq5DYt4itdtb7c7HG7+r7nsHtoPVJgtCBSBMk+nKNn88Xy6cDbdMuEBIHahoRtaY7Us+dIRomDaqrO4hQJydp-EC4JODAZQYjIADCqrquyAAUggqKQKh0sAT5cugWZ-HAKBgkBKIgT4ACUDbrluJZlnutpUgwcBmHA5QwMeTbnrYbbOFeN69kg-YPoJwmibAtAWM4gHAaBtrgZBKkiWJsHwXSiF-MhqG2uhmFcjh8JIARaoaqRKhkVR7hgJyMAAApIM4dEwAxTEsWxnFjl+P4MAu9r-qudLcYaVjxpCUCNqezZmIGDLsrQ7JgNWgZUHSALdAFVi5flhWiFQCFQBafQxTZYKUrY-QoJizowMRFF0r1uBtRAyCwGC3kAKKOsNMAAEImD8xEADogFWNZ1kt7HMTpnHpuUuB5slMCpcmUImt0iZGLWNJSlqIA0TA1oEN59mfE5RGuX1lGPtBR7sUYhlqfdj12R8+GES57nubanneX5Wm-X4agILYlRbAAVmgHRqKE4TkJE0SxPE7BJCkaQZLwWQ5HkSAFBg2AgOsmzBMw4gCFYlysFwDAZIkSSpAo0T8Pw1BXII5DkwI6IOT8BAAsCoIQtCsIOVC5QyuYMCS1iOIEGN9VgOrRiMm2BAUoJtIMqSbbMqyHJcjyfICkKIrvIeGvBEYyBBcjAyYCA4ioCAnQgJ7AK-P7aBqCagnwKqWx6wb-hrBsvyxLw4iiLwszMKQoh0GwYvXLwzC4NEOeJMwhDMLEzDxJrMjS8EssguCkIwiDSBQppYC0CgbVvhrXS4Ug2IlCAsMdtofdch7yO4hm9KqiiJhGF3I+4tU+gw-5Lju2oXUFQwMBfPVtgIMW7IACIeOIGBLiuxLmBlt9xR0fhAA`;
export const send: CarouselItem = {
  boardUrl,
  videoUrl: "/assets/teaser/TextSend2.mp4",
  headline,
  title: `Sample 3: ${capitaliseHeadline(headline)}`,
  description: (
    <div className="flex flex-col gap-2">
      <div>
        Sometimes, there is a need to pass a secret access code, serial number,
        or even a password from one device to another. Ideally, without taking a
        detour through the public internet.
      </div>
      <div>
        This video demonstrates two boards that appear almost like small apps
        using the fullscreen mode of the HTML service for easier access: one for
        sending and one for receiving textual data. Click on the video, and you
        will be directed to the sender's playground. The according receiver
        board{" "}
        <a
          href={`/playground/receiver-${createShortRandomString()}?fromLink=N4IgTgrgdgLglgWwKYGcQC4Dao4BMMhICGAxgIwCcZAHAKwC0AbEbQOz0AsRATEfRRWpl6ABiQcSAMxG1quRow4gANCChFkBAMpFJRMHBUgYATwAOSAgCMwAewDuKJGCMoYRGJfTAAvj+U4+OggktSsAmQAzEj0ZFZkMVzc3PREuOlMImSsjLRkHIwkIqxG6prBOnoGRqYW1naOzq7unhi+PgC6qk5gAG5wJKhthKSUNAzMbJw8fAJCouJSMnIKSligEBB4BLhkjLjkJLixuJHHHGGM-JGRKVZIZJJkRPH7IhSuzv2DAJJBIAALWy2ADWEDMADoYLYAPQ9b5IGEWZz0FC2EggpAwT59AZIAByGi8IAACkhnAACLTozHY1QIWy4YkAJSQgzgvSQFNsUAANiYjMiwITyiAjEgAB4wMCkGA-KAkWwIOBQADmABEPEQMNKIEhVFZzEQUGh0HpeU5-Bstv8kDJuIwRIx2GIHZwrLg+EQEsIKCRqLwHlZGFZuNQcQi-gQgaDwVDYfC8TCmSQwOY6SBE4MRcT1Wy02YM1ZbPp-kyzGA2R4kLgKcXS2UufQKaqsRS4DAKZI7AgKUQzGZPqmsQQjMgYEDcKbMCAiEMuiBx5OCHO0KpcHBKyR4Dydvn0yBOqpQuEqNFYvFEjwUmkMo7srl8oVihhsCBNttgtwqCQiCJqNQ9BWFY1CSJwCQcEBtDcJBFBEGEYSRBwyFECU3RfHiUbBDGYKQtCcIYYMMIAjACC8hGeI5gQAASpHkQaJZgGWSAVlWni1vWTGNhSzatp2HZdj2fYDkYkgQLyFrDkgUA6pA+ogIqUCSHAqrDJ4CBmLy1YEAAPBuvQUiQWkmgAvAA5JIvKSl2VkSvQiq8hSZh2RwLb9vQ3AUvY9CYNQIgAKQdBSCCpBA0JmQAfDpAJkBFrLspyFKeFKOnEbFFI6SqZhhe2uDmY2ZmGcZKDmcWTGUmYHmFZppBIECvJMmA5kICYFIFRSvRELyermTp-kmcFJg5hS-kRYVPIkACRBqkg5kAiCkJODAWiEUgADCPLKaqAAUIjKHtFLAEKOboElAJwCgEKdd1SA+AAlIVKAWBJk1siC5nmk4hUwhFGVZTleDmU4w4wIVRnGiVZllY1TlVU5WmDPVjVA-mWL0JiJiFddPVmX1A3A5WnajeNCpTTNc0LRCS0rbigwbUpKm7coZDKIdBNYqdE4XVdXV6vdj3Pbyr0Yh9XVfRSP0Zfpv1405+gaCgI0y8mHJRSrvQRUYvLomLwwtTmJkEHxNMIvTW1M3tZnHUSZl3UOhOG8ExurWbjN7SzZns6DduqGY8sIKaYp+PSjLEkgABWaCdH4QA`}
          target="_blank"
        >
          is available here
        </a>
        .
      </div>
      <div>
        Now assign a unique name to the receiver and configure the sender with
        this name, along with an encryption key for the session. The receiver
        will be configured accordingly to decode incoming data.
      </div>
    </div>
  ),
  background: "/assets/teaser/blue3.png",
  action: {
    title: "Open in Playground",
    onClick: {
      url: boardUrl,
    },
  },
  createdAt: "Jul 19, 2024",
};
