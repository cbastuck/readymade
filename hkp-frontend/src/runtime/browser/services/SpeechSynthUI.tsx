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
    const voices = speechSynthesis.getVoices();
    const lang = "en-GB"; //"de-DE"
    const voicesMatchingLang = voices.filter((voice) => voice.lang === lang);
    const defaultVoice = voicesMatchingLang.find(
      (voice) => voice.name === defaultVoiceName
    );

    props.service.configure({
      voices: voicesMatchingLang,
    });
    if (currentVoice === null && defaultVoice) {
      setCurrentVoice(defaultVoice);
    }
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
