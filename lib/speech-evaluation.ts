export interface SpeechEvaluationInput {
  audioPath: string;
  expectedText: string;
  language: string;
}

export interface SpeechEvaluationResult {
  provider: string;
  completed: boolean;
  durationRatio?: number;
  rhythmHint: string;
  message: string;
}

export interface SpeechEvaluationProvider {
  evaluate(input: SpeechEvaluationInput): Promise<SpeechEvaluationResult>;
}

export class ManualSpeechEvaluationProvider implements SpeechEvaluationProvider {
  async evaluate(
    input: SpeechEvaluationInput,
  ): Promise<SpeechEvaluationResult> {
    return {
      provider: "manual",
      completed: Boolean(input.audioPath),
      rhythmHint: "先比较停顿位置和句尾语调，再完成 1–5 分自评。",
      message: `MVP 不会假装自动判断“${input.expectedText}”的发音准确度。请以原音对比和自评为准。`,
    };
  }
}
