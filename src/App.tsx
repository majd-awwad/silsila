import { Suspense, lazy, useEffect, useReducer, useState } from 'react';
import { initialState, reducer } from './flow/machine';
import { getPack } from './packs';
import { Quiz } from './screens/Quiz';
import { Summary } from './screens/Summary';
import { Teacher } from './screens/Teacher';
import { Welcome } from './screens/Welcome';
import { saveSession } from './store/sessions';

// the 3D lab (three.js) loads only when the child reaches it
const Lab = lazy(() => import('./screens/Lab').then((m) => ({ default: m.Lab })));

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  const [state, dispatch] = useReducer(reducer, initialState);

  // every change to the child's session is saved on this device
  useEffect(() => {
    if (state.session) saveSession(state.session).catch(() => {});
  }, [state.session]);

  if (hash.startsWith('#/teacher')) return <Teacher />;

  switch (state.phase) {
    case 'welcome':
      return <Welcome onStart={(st) => dispatch({ type: 'START', ...st })} />;
    case 'pretest':
      return (
        <Quiz
          key="pre" title="قبل ما نبلّش: ٤ أسئلة"
          intro="جاوب زي ما بتفكّر. مش امتحان، ولا في علامة."
          questions={getPack(state.session?.pack).preTest} onDone={(result) => dispatch({ type: 'PRE_DONE', result })}
        />
      );
    case 'lab':
      return (
        <Suspense fallback={<main className="stage-bg min-h-full grid place-items-center text-ink-2">نور عم تجهّز المختبر…</main>}>
          <Lab state={state} dispatch={dispatch} />
        </Suspense>
      );
    case 'posttest':
      return (
        <Quiz
          key="post" title="آخر خطوة: ٤ أسئلة"
          intro="هلأ بعد ما جرّبت وعلّمت نور، جاوب هالأسئلة."
          questions={getPack(state.session?.pack).postTest} onDone={(result) => dispatch({ type: 'POST_DONE', result })}
        />
      );
    case 'summary':
      return state.session ? <Summary session={state.session} onRestart={() => dispatch({ type: 'RESTART' })} /> : null;
  }
}
