import React from 'react';
import styles from './Chat.module.css';

const Header: React.FC = () => {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <h1>OpenAI Assistant Chat</h1>
      </div>
    </header>
  );
};

export default Header; 