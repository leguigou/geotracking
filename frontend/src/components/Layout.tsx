import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      <Sidebar />
      <main className="ml-60 min-h-screen p-6 lg:p-8 transition-colors duration-300">
        <Outlet />
      </main>
    </div>
  );
}
