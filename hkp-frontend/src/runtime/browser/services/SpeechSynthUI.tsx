import { useState } from "react";

import { ServiceUIProps } from "hkp-frontend/src/types";

import ServiceUI, {
  needsUpdate,
} from "hkp-frontend/src/ui-components/service/ServiceUI";
import SelectorField, {
  OnChangeValue,
  arrayToOptions,
} from "hkp-frontend/src/components/shared/SelectorField";

const defaultVoiceName = "Daniel";

export default function SpeechSynthUI(props: ServiceUIProps) {
  const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(
    null
  );
  const [voices, setVoices] = useState<Array<SpeechSynthesisVoice>>([]);

  const onSpeak = (msg: string) => {
    const utter = new SpeechSynthesisUtterance(msg);
    utter.voice = currentVoice || voices[0];
    speechSynthesis.speak(utter);
  };

  const update = (state: any) => {
    if (needsUpdate(state.voices, voices)) {
      setVoices(state.voices);
    }
    if (state.incoming !== undefined) {
      onSpeak(state.incoming);
    }
  };

  const onInit = (state: any) => {
    update(state);

    let loaded = false;

    const loadVoices = () => {
      const all = speechSynthesis.getVoices();
      if (all.length === 0) {
        return;
      }
      if (loaded) {
        return;
      }
      loaded = true;

      // Prefer en-GB, fall back to any English, then all voices.
      let pool = all.filter((v) => v.lang === "en-GB");
      if (pool.length === 0) pool = all.filter((v) => v.lang.startsWith("en"));
      if (pool.length === 0) pool = all;

      const defaultVoice = pool.find((v) => v.name === defaultVoiceName) ?? pool[0];
      props.service.configure({ voices: pool });
      if (currentVoice === null && defaultVoice) {
        setCurrentVoice(defaultVoice);
      }
    };

    // Chrome/Firefox fire onvoiceschanged; Safari may have voices synchronously
    // or never fire the event — poll as a fallback.
    speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();

    // Safari fallback: poll until voices appear (up to ~3 s).
    let attempts = 0;
    const poll = setInterval(() => {
      loadVoices();
      if (loaded || ++attempts >= 15) {
        clearInterval(poll);
      }
    }, 200);
  };
  const onNotification = (notification: any) => update(notification);

  const options = arrayToOptions(voices.map((v) => v.name));

  const onChangeVoice = ({ index }: OnChangeValue) => {
    setCurrentVoice(voices[index]);
  };

  return (
    <ServiceUI
      className="pb-4"
      {...props}
      onInit={onInit}
      onNotification={onNotification}
      initialSize={{ width: 400, height: undefined }}
    >
      <div className="flex flex-col">
        <h1>Speech</h1>
        <SelectorField
          label="Voice"
          value={currentVoice?.name || ""}
          onChange={onChangeVoice}
          options={options}
        />
      </div>
    </ServiceUI>
  );
}
