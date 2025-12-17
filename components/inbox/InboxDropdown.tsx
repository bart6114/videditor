import { useState } from 'react';
import { Bell, AlertCircle, Info, Megaphone, Check, Loader2, ExternalLink } from 'lucide-react';
import { useInbox } from '@/hooks/useInbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { InboxMessageData, InboxMessageType } from '@shared/index';

const MESSAGE_ICONS: Record<InboxMessageType, typeof AlertCircle> = {
  error: AlertCircle,
  info: Info,
  announcement: Megaphone,
};

const MESSAGE_COLORS: Record<InboxMessageType, string> = {
  error: 'text-destructive',
  info: 'text-info',
  announcement: 'text-accent',
};

const MESSAGE_BG_COLORS: Record<InboxMessageType, string> = {
  error: 'bg-destructive/10',
  info: 'bg-info/10',
  announcement: 'bg-accent/10',
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

type InboxMessageItemProps = {
  message: InboxMessageData;
  onClick: () => void;
};

function InboxMessageItem({ message, onClick }: InboxMessageItemProps) {
  const Icon = MESSAGE_ICONS[message.type];
  const iconColor = MESSAGE_COLORS[message.type];

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-3 py-2.5 hover:bg-secondary/50 transition-colors text-left ${
        !message.isRead ? 'bg-secondary/30' : ''
      }`}
    >
      <div className={`flex-shrink-0 mt-0.5 ${iconColor}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={`text-sm truncate ${
              !message.isRead ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'
            }`}
          >
            {message.title}
          </p>
          {!message.isRead && (
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatRelativeTime(message.createdAt)}
        </p>
      </div>
    </button>
  );
}

type InboxMessageDialogProps = {
  message: InboxMessageData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkAsRead: (messageId: string) => Promise<void>;
};

function InboxMessageDialog({
  message,
  open,
  onOpenChange,
  onMarkAsRead,
}: InboxMessageDialogProps) {
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  if (!message) return null;

  const Icon = MESSAGE_ICONS[message.type];
  const iconColor = MESSAGE_COLORS[message.type];
  const bgColor = MESSAGE_BG_COLORS[message.type];

  const handleMarkAsRead = async () => {
    if (message.isRead) return;
    setIsMarkingRead(true);
    try {
      await onMarkAsRead(message.id);
      onOpenChange(false);
    } finally {
      setIsMarkingRead(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${bgColor}`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div>
              <DialogTitle>{message.title}</DialogTitle>
              <DialogDescription>
                {formatRelativeTime(message.createdAt)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-foreground whitespace-pre-wrap">{message.body}</p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {message.actionUrl && message.actionLabel && (
            <Button asChild variant="default">
              <a
                href={message.actionUrl}
                target={message.actionUrl.startsWith('http') ? '_blank' : undefined}
                rel={message.actionUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
              >
                {message.actionLabel}
                {message.actionUrl.startsWith('http') && (
                  <ExternalLink className="w-4 h-4 ml-2" />
                )}
              </a>
            </Button>
          )}
          {!message.isRead && (
            <Button variant="outline" onClick={handleMarkAsRead} disabled={isMarkingRead}>
              {isMarkingRead ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Mark as read
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InboxDropdown() {
  const { messages, unreadCount, isLoading, markAsRead, markAllAsRead } = useInbox();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<InboxMessageData | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  const handleMessageClick = async (message: InboxMessageData) => {
    setSelectedMessage(message);
    setDialogOpen(true);
    setIsOpen(false);

    // Auto-mark as read when opening
    if (!message.isRead) {
      try {
        await markAsRead(message.id);
      } catch {
        // Silently handle - message dialog is still shown
      }
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMarkingAllRead(true);
    try {
      await markAllAsRead();
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  return (
    <div className="relative">
      {/* Inbox Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-secondary/50 transition-colors"
        aria-label={`Inbox${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-destructive rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-20 w-80 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Inbox</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={isMarkingAllRead}
                  className="text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  {isMarkingAllRead ? 'Marking...' : 'Mark all read'}
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <Bell className="w-8 h-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    You&apos;ll be notified about important updates here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {messages.map((message) => (
                    <InboxMessageItem
                      key={message.id}
                      message={message}
                      onClick={() => handleMessageClick(message)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Message Dialog */}
      <InboxMessageDialog
        message={selectedMessage}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onMarkAsRead={markAsRead}
      />
    </div>
  );
}
