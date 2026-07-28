export interface JapaneseSpeechOptions {
  rate?: number;
  volume?: number;
}

export function supportsJapaneseSpeech() {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

export function cancelJapaneseSpeech() {
  if (supportsJapaneseSpeech()) {
    window.speechSynthesis.cancel();
  }
}

export function speakJapanese(
  text: string,
  options: JapaneseSpeechOptions = {},
): Promise<void> {
  if (!supportsJapaneseSpeech()) {
    return Promise.reject(new Error("当前浏览器不支持日语朗读。"));
  }
  window.speechSynthesis.cancel();
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = options.rate ?? 1;
    utterance.volume = options.volume ?? 1;
    const japaneseVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("ja"));
    if (japaneseVoice) {
      utterance.voice = japaneseVoice;
    }
    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      if (event.error === "canceled" || event.error === "interrupted") {
        resolve();
      } else {
        reject(new Error("浏览器日语朗读失败。"));
      }
    };
    window.speechSynthesis.speak(utterance);
  });
}
