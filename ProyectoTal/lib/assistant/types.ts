/** Something the assistant can do in the app, shown as a button under its answer. */
export type ChatAction =
  | { kind: "fly"; id: string; label: string }
  | { kind: "story"; id: string; label: string }
  | { kind: "lens" }
  | { kind: "community" }
  | { kind: "dance" }
  | { kind: "demo" };

export type Lang = "en" | "es";

export interface AssistantReply {
  text: string;
  /** Buttons under the answer. */
  actions: ChatAction[];
  /** Actions to run straight away (the user asked for them). */
  run: ChatAction[];
  /** The case the answer was about, so "there" in the next question means it. */
  topicId?: string;
}
