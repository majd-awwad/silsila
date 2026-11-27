import { Suspense, lazy } from 'react';
import { Landing } from './features/landing/Landing';
import { useRoute } from './router';
import { EmptyState, Loading, Shell } from './ui/kit';
import { useI18n } from './i18n';

const StudentApp = lazy(() => import('./features/student/StudentApp').then((m) => ({ default: m.StudentApp })));
const JoinApp = lazy(() => import('./features/join/JoinApp').then((m) => ({ default: m.JoinApp })));
const TeacherApp = lazy(() => import('./features/teacher/TeacherApp').then((m) => ({ default: m.TeacherApp })));
const ScreenApp = lazy(() => import('./features/screen/ScreenApp').then((m) => ({ default: m.ScreenApp })));
const Passport = lazy(() => import('./features/passport/Passport').then((m) => ({ default: m.Passport })));
const Vision = lazy(() => import('./features/judge/Vision').then((m) => ({ default: m.Vision })));
const JudgeApp = lazy(() => import('./features/judge/JudgeApp').then((m) => ({ default: m.JudgeApp })));

function NotFound() {
  const { t } = useI18n();
  return (
    <Shell narrow>
      <EmptyState action={<a className="btn btn-primary" href="#/">{t({ ar: 'الصفحة الرئيسية', en: 'Home' })}</a>}>
        {t({ ar: 'هالصفحة مش موجودة.', en: 'This page does not exist.' })}
      </EmptyState>
    </Shell>
  );
}

/** #/ · #/learn/:pack? · #/join/:code? · #/teacher/… · #/screen/:code · #/judge · #/passport */
export default function App() {
  const { path } = useRoute();
  const [area, ...rest] = path;
  const page = () => {
    switch (area) {
      case undefined: return <Landing />;
      case 'learn': return <StudentApp path={rest} />;
      case 'join': return <JoinApp code={rest[0]?.toUpperCase() ?? null} />;
      case 'teacher': return <TeacherApp path={rest} />;
      case 'screen': return <ScreenApp code={rest[0]?.toUpperCase() ?? null} />;
      case 'judge': return rest[0] === 'vision' ? <Vision /> : <JudgeApp path={rest} />;
      case 'passport': return <Passport />;
      default: return <NotFound />;
    }
  };
  return <Suspense fallback={<Loading />}>{page()}</Suspense>;
}
