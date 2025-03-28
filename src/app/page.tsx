import Header from './components/Header';
import Chat from './components/Chat';

export default function Home() {
  return (
    <div className="main-container">
      <Header />
      <main>
        <Chat />
      </main>
      <footer>
        <p>Powered by OpenAI Assistants API</p>
      </footer>
    </div>
  );
}
