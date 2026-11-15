import { data } from "./data";
import { methods } from "./methods";
import { more } from "./more";
import { people } from "./people";
import { panel } from "./panel";
import { shell } from "./shell";
import { story } from "./story";
import { ui } from "./ui";
import { water } from "./water";

/**
 * Spanish, keyed by the English sentence. One file per area keeps three
 * people from editing the same lines; add yours to the spread below.
 */
export const es: Record<string, string> = {
  ...shell,
  ...data,
  ...ui,
  ...panel,
  ...story,
  ...methods,
  ...more,
  ...people,
  ...water,
};
