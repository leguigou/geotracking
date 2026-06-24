import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      {/* Hamburger button — visible only on mobile */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 lg:hidden"
        aria-label="Menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="min-h-screen p-4 lg:ml-60 lg:p-8 pt-14 lg:pt-8 transition-all duration-300">
        <Outlet />
      </main>
    </div>
  );
}
