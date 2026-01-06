import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout';
import { HomePage, UsersPage, MatchesPage } from './pages';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/matches" element={<MatchesPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
