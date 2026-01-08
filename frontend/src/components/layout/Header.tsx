import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Header.css';

export function Header() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo" onClick={closeMenu}>
          <span className="logo-my">My</span> Chess League
        </Link>

        <button
          className={`menu-toggle ${isMenuOpen ? 'open' : ''}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}
        >
          <span className="menu-bar"></span>
          <span className="menu-bar"></span>
          <span className="menu-bar"></span>
        </button>

        <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
          <Link
            to="/"
            className={`nav-link ${isActive('/') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Home
          </Link>
          <Link
            to="/users"
            className={`nav-link ${isActive('/users') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Users
          </Link>
          <Link
            to="/leagues"
            className={`nav-link ${isActive('/leagues') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            League
          </Link>
          <Link
            to="/tournaments"
            className={`nav-link ${isActive('/tournaments') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Tournament
          </Link>
          <Link
            to="/matches"
            className={`nav-link ${isActive('/matches') ? 'active' : ''}`}
            onClick={closeMenu}
          >
            Matches
          </Link>
        </nav>

        {isMenuOpen && <div className="nav-overlay" onClick={closeMenu} />}
      </div>
    </header>
  );
}
