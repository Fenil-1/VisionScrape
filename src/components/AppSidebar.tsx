import { ScanText } from 'lucide-react';
import { MODULES } from '../modules';

interface Props {
  activeId: string;
  onSelect: (id: string) => void;
}

export function AppSidebar({ activeId, onSelect }: Props) {
  return (
    <nav className="app-sidebar">
      <div className="app-sidebar__brand">
        <ScanText size={24} />
        <div>
          <strong>VisionScrape</strong>
          <span>AI image → spreadsheet</span>
        </div>
      </div>

      <div className="app-sidebar__modules">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              className={`module-item ${m.id === activeId ? 'module-item--active' : ''}`}
              onClick={() => m.available && onSelect(m.id)}
              disabled={!m.available}
              title={m.available ? m.subtitle : `${m.subtitle} — coming soon`}
            >
              <Icon size={18} />
              <span className="module-item__text">
                <span className="module-item__title">{m.title}</span>
                <span className="module-item__subtitle">{m.subtitle}</span>
              </span>
              {!m.available && <span className="module-item__badge">Soon</span>}
            </button>
          );
        })}
      </div>

      <div className="app-sidebar__footer">
        <span>Powered by Gemini</span>
      </div>
    </nav>
  );
}
