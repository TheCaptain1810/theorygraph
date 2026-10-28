import { Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { LoginPage, SignupPage } from './pages/AuthPages';
import { NotFoundPage } from './pages/ComingSoon';
import { EditInterpretation } from './pages/EditInterpretation';
import { FilmDetail } from './pages/FilmDetail';
import { Films } from './pages/Films';
import { Guidelines } from './pages/Guidelines';
import { InterpretationDetail } from './pages/InterpretationDetail';
import { Landing } from './pages/Landing';
import { Moderation } from './pages/Moderation';
import { NewInterpretation } from './pages/NewInterpretation';
import { Profile } from './pages/Profile';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="films" element={<Films />} />
        <Route path="films/:filmId" element={<FilmDetail />} />
        <Route path="interpretations/:interpretationId" element={<InterpretationDetail />} />
        <Route
          path="interpretations/:interpretationId/edit"
          element={
            <RequireAuth>
              <EditInterpretation />
            </RequireAuth>
          }
        />
        <Route path="guidelines" element={<Guidelines />} />
        <Route
          path="new/interpretation"
          element={
            <RequireAuth>
              <NewInterpretation />
            </RequireAuth>
          }
        />
        <Route
          path="moderation"
          element={
            <RequireAuth>
              <Moderation />
            </RequireAuth>
          }
        />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route path="profile/:username" element={<Profile />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
