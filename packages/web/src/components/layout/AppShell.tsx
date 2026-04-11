import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import { ChatFab } from '../../features/chat/ChatFab';
import { ChatProvider } from '../../features/chat/ChatController';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ChatProvider>
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always visible on desktop, slide-in on mobile */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 ease-in-out
        lg:relative lg:translate-x-0 lg:z-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Mobile header with hamburger */}
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-gray-900">Vibe MyBooks</span>
        </div>
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>

      {/* AI chat assistant — only renders if chat is enabled at both
          the system and company level (handled inside ChatFab). */}
      <ChatFab />
    </div>
    </ChatProvider>
  );
}
