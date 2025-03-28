import React from 'react';
import styles from './Chat.module.css';

const Header: React.FC = () => {
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <div className={styles.logo}>
          <h1>Build<br />Canada</h1>
        </div>
        {/* Navigation links removed */}
      </nav>
    </header>
  );
};

export default Header; 