import React from 'react';
import Header from './components/Header';
import Chat from './components/Chat';
import styles from './components/Chat.module.css';

export default function Home() {
  return (
    <div className="main-container">
      <Header />
      <section className={styles.heroSection}>
        <h1 className={styles.heroTitle}>Build Canada</h1>
        <h2 className={styles.heroSubtitle}>Policy Explorer</h2>
      </section>
      <main>
        <Chat />
      </main>
      <footer>
        {/* Footer content removed */}
      </footer>
    </div>
  );
}
