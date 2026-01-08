import { Link, useLocation } from 'react-router-dom';
import './Header.css';

export function Header() {
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <span className="logo-my">My</span> Chess League
        </Link>
        <nav className="nav">
          <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
            Home
          </Link>
          <Link to="/users" className={`nav-link ${isActive('/users') ? 'active' : ''}`}>
            Users
          </Link>
          <Link to="/leagues" className={`nav-link ${isActive('/leagues') ? 'active' : ''}`}>
            League
          </Link>
          <Link to="/tournaments" className={`nav-link ${isActive('/tournaments') ? 'active' : ''}`}>
            Tournament
          </Link>
          <Link to="/matches" className={`nav-link ${isActive('/matches') ? 'active' : ''}`}>
            Matches
          </Link>
        </nav>
      </div>
    </header>
  );
}
