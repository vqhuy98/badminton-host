import { useEffect, useState } from 'react';
import { Toaster } from './components/ui';
import Home from './screens/Home';
import SessionScreen from './screens/SessionScreen';
import PlayersScreen from './screens/PlayersScreen';

export type Route =
  | { name: 'home' }
  | { name: 'session'; id: string }
  | { name: 'players' };

function parseHash(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const [head, arg] = h.split('/');
  if (head === 'session' && arg) return { name: 'session', id: arg };
  if (head === 'players') return { name: 'players' };
  return { name: 'home' };
}

export function navigate(route: Route) {
  location.hash =
    route.name === 'session' ? `#/session/${route.id}` : route.name === 'players' ? '#/players' : '#/';
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  return (
    <div className="mx-auto min-h-full max-w-lg pb-24">
      {route.name === 'home' && <Home />}
      {route.name === 'players' && <PlayersScreen />}
      {route.name === 'session' && <SessionScreen sessionId={route.id} />}
      <Toaster />
    </div>
  );
}
