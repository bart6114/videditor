import { ReactNode, useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';
import MobileDrawer from './MobileDrawer';
import { InboxDropdown } from '@/components/inbox';
import { Button } from '@/components/ui/button';

interface WorkspaceLayoutProps {
  children: ReactNode;
  title?: string;
  onTitleSave?: (newTitle: string) => Promise<void>;
}

export default function WorkspaceLayout({ children, title, onTitleSave }: WorkspaceLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title || '');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update editValue when title changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(title || '');
    }
  }, [title, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (onTitleSave) {
      setEditValue(title || '');
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    const trimmedValue = editValue.trim();
    if (!trimmedValue || trimmedValue === title) {
      setIsEditing(false);
      setEditValue(title || '');
      return;
    }

    setIsSaving(true);
    try {
      await onTitleSave?.(trimmedValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save title:', error);
      // Keep editing mode open on error
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(title || '');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div className="flex min-h-screen md:h-screen bg-background md:overflow-hidden">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      <MobileDrawer open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:overflow-hidden">
        {/* Mobile Header - visible only on mobile */}
        <MobileHeader title={title} isEntityTitle={!!onTitleSave} onMenuClick={() => setMobileMenuOpen(true)} />

        {/* Desktop Top Bar - hidden on mobile */}
        <div className="hidden md:flex h-16 bg-card border-b-2 border-border items-center justify-between px-8 scanlines-subtle">
          <div className="flex items-center gap-2 min-w-0">
            {title && (
              isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSave}
                    disabled={isSaving}
                    className="text-xl font-display tracking-widest text-primary bg-transparent border-b-2 border-primary focus:outline-none px-0 py-0 min-w-[200px]"
                    maxLength={255}
                  />
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => { e.preventDefault(); handleSave(); }}
                      >
                        <Check className="w-4 h-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => { e.preventDefault(); handleCancel(); }}
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className={`text-xl font-display tracking-widest text-primary truncate ${onTitleSave ? '' : 'uppercase'}`}>{title}</h1>
                  {onTitleSave && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={handleStartEdit}
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              )
            )}
          </div>
          <div className="flex items-center">
            <InboxDropdown />
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 md:overflow-y-auto circuit-grid">
          <div className="p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
