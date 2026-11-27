/** What every tab of the control room receives. */
import type { LearnerRecord, TeacherOp, TeacherRoomView } from '../../../contracts';
import type { ConceptPack } from '../../../packs/types';
import type { RoomTab } from '../logic/insight';

export interface RoomTabProps {
  pack: ConceptPack;
  view: TeacherRoomView;
  records: LearnerRecord[];
  /** true when the server accepted the operation */
  act(op: TeacherOp): Promise<boolean>;
  busy: boolean;
  /** the room can no longer be changed (closed or expired) */
  readOnly: boolean;
  goTab(tab: RoomTab): void;
}
