import { Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { AdminPage } from "./pages/AdminPage";
import { GamePage } from "./pages/GamePage";
import { JoinPage } from "./pages/JoinPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { LobbyPage } from "./pages/LobbyPage";
import { useGameSocket } from "./hooks/useGameSocket";

function App() {
  useGameSocket();

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M6 7h8c-2-6 7-6 5 0h7v8c-6-2-6 7 0 5v6h-8c2-6-7-6-5 0H6v-8c6 2 6-7 0-5V7Z" fill="currentColor" />
            </svg>
          </span>
          <div><strong>Jigsaw Arena</strong><span className="brand-caption">A little focus. A lot of fun.</span></div>
        </div>
        <span className="header-caption">Five rounds. One challenge.</span>
      </header>
    <Routes>
      <Route path="/" element={<JoinPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/join/:eventId" element={<JoinPage />} />
      <Route path="/lobby/:eventId" element={<LobbyPage />} />
      <Route path="/game/:eventId/:roundNumber" element={<GamePage />} />
      <Route
        path="/leaderboard/:eventId/:roundNumber"
        element={<LeaderboardPage />}
      />
    </Routes>
    </div>
  );
}

export default App;
