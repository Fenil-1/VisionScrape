import { useState } from 'react';
import { AppSidebar } from './components/AppSidebar';
import { LeadsScraper } from './components/LeadsScraper';
import { MODULES } from './modules';

const ACTIVE_MODULE_KEY = 'visionscrape-active-module';

export default function App() {
  const [activeId, setActiveId] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_MODULE_KEY);
    return MODULES.some((m) => m.id === saved && m.available) ? saved! : MODULES[0].id;
  });

  const select = (id: string) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_MODULE_KEY, id);
  };

  return (
    <div className="app">
      <AppSidebar activeId={activeId} onSelect={select} />
      <div className="app-main">
        {activeId === 'leads-scraper' && <LeadsScraper />}
        {/* Future modules mount here, keyed by their id from src/modules.ts */}
      </div>
    </div>
  );
}
