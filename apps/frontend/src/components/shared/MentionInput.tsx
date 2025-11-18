import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { Loader2, User } from 'lucide-react';
import type { UserSummary } from '@/types/users';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  multiline?: boolean;
}

export function MentionInput({
  value,
  onChange,
  placeholder,
  rows = 3,
  className = '',
  multiline = true,
}: MentionInputProps) {
  const [mentionQuery, setMentionQuery] = useState<string>('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch users for autocomplete
  const { data: usersResponse, isLoading: isUsersLoading } = useQuery({
    queryKey: ['users', 'mentions'],
    queryFn: () => usersApi.getOptions({ page: 1, pageSize: 100, isActive: true }),
  });

  const users = useMemo(() => usersResponse?.data ?? [], [usersResponse]);

  // Filter users based on mention query
  const filteredUsers = useMemo(() => {
    if (!mentionQuery.trim()) {
      return users.slice(0, 10); // Show first 10 users when no query
    }

    const query = mentionQuery.toLowerCase();
    return users
      .filter((user) => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        const email = user.email.toLowerCase();
        return (
          fullName.includes(query) ||
          email.includes(query) ||
          user.firstName?.toLowerCase().includes(query) ||
          user.lastName?.toLowerCase().includes(query)
        );
      })
      .slice(0, 10);
  }, [users, mentionQuery]);

  // Handle input change and detect @mentions
  const handleChange = (newValue: string) => {
    onChange(newValue);
    
    // Use setTimeout to get updated cursor position after React updates
    setTimeout(() => {
      const cursorPosition = inputRef.current?.selectionStart ?? newValue.length;
      const textBeforeCursor = newValue.substring(0, cursorPosition);
      
      // Find the last @ symbol before cursor
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      
      if (lastAtIndex !== -1) {
        // Check if there's a space or newline after @ (meaning mention is complete)
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        const hasSpaceOrNewline = /\s/.test(textAfterAt);
        
        if (!hasSpaceOrNewline) {
          // We're in a mention - extract the query (can be empty if just typed @)
          const query = textAfterAt;
          setMentionQuery(query);
          setMentionStart(lastAtIndex);
          setSelectedIndex(0);
          return;
        }
      }
      
      // Not in a mention
      setMentionQuery('');
      setMentionStart(null);
    }, 0);
  };

  // Insert mention into text
  const insertMention = (user: UserSummary) => {
    if (mentionStart === null || !inputRef.current) return;

    const cursorPosition = inputRef.current.selectionStart ?? value.length;
    const beforeMention = value.substring(0, mentionStart);
    const afterMention = value.substring(cursorPosition);
    
    // Use full name for mention
    const mentionText = `@${user.firstName} ${user.lastName}`;
    const newValue = beforeMention + mentionText + ' ' + afterMention;
    
    onChange(newValue);
    setMentionQuery('');
    setMentionStart(null);
    
    // Set cursor position after the mention
    setTimeout(() => {
      if (inputRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length + 1;
        if (multiline && inputRef.current instanceof HTMLTextAreaElement) {
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          inputRef.current.focus();
        } else if (!multiline && inputRef.current instanceof HTMLInputElement) {
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          inputRef.current.focus();
        }
      }
    }, 0);
  };

  // Handle keyboard navigation in dropdown
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (mentionStart === null) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredUsers.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter' && filteredUsers.length > 0) {
      event.preventDefault();
      insertMention(filteredUsers[selectedIndex]);
    } else if (event.key === 'Escape') {
      setMentionQuery('');
      setMentionStart(null);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setMentionQuery('');
        setMentionStart(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          className={className}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={className}
        />
      )}
      
      {mentionStart !== null && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg"
          style={{
            top: '100%',
            left: 0,
            marginTop: '4px',
          }}
        >
          {isUsersLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No users found
            </div>
          ) : (
            filteredUsers.map((user, index) => (
              <button
                key={user.id}
                type="button"
                onClick={() => insertMention(user)}
                className={`w-full px-3 py-2 text-left text-sm transition hover:bg-muted ${
                  index === selectedIndex ? 'bg-blue-50 font-semibold' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-foreground">
                      {user.firstName} {user.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

