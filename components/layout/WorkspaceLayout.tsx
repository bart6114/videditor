import { ReactNode } from 'react';
import Sidebar from './Sidebar';

interface WorkspaceLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function WorkspaceLayout({ children, title }: WorkspaceLayoutProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Minimal Top Bar */}
        {title && (
          <div className="h-16 bg-card border-b border-border flex items-center px-8">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
