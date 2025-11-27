import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  useEffect(() => {
    document.title = "Home"; // <-- this changes the tab title
  }, []);

  return (
    <div>
      <h1>Home</h1>
      <Link to="/test">Go to Speech Emotion Recognition</Link>
    </div>
  );
}
