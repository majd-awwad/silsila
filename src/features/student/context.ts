/** What every lesson screen receives. */
import type { Action, Journey } from '../../flow/journey';
import type { ConceptPack } from '../../packs/types';

export interface LessonProps {
  pack: ConceptPack;
  journey: Journey;
  dispatch: (action: Action) => void;
  /** judge mode: sample sentences and the reasoning panel */
  judge: boolean;
  /** a language call is running */
  busy: boolean;
  /** each resolves to true when the reply was used */
  explain: (input: string) => Promise<boolean>;
  teach: (text: string) => Promise<boolean>;
  answerChallenge: (text: string) => Promise<boolean>;
  transfer: (text: string) => Promise<boolean>;
}
