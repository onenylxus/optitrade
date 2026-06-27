'use client';

import { useCallback, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useLayoutContext } from '@/contexts/layout-context';
import { cn } from '@/lib/utils';

interface LayoutSwitcherProps {
  isEditMode: boolean;
}

export function LayoutSwitcher({ isEditMode }: LayoutSwitcherProps) {
  const {
    layouts,
    activeLayoutId,
    switchLayout,
    createLayout,
    duplicateLayout,
    renameLayout,
    deleteLayout,
    maxLayoutsReached,
  } = useLayoutContext();

  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  const activeLayout = layouts.find((l) => l.id === activeLayoutId);
  const activeName = activeLayout?.name ?? 'Layout';

  const handleToggle = useCallback(() => {
    if (isEditMode) {
      setOpen((prev) => !prev);
    }
  }, [isEditMode]);

  const handleSelect = useCallback(
    (layoutId: string) => {
      if (layoutId !== activeLayoutId) {
        void switchLayout(layoutId);
      }

      setOpen(false);
    },
    [activeLayoutId, switchLayout],
  );

  const handleCreate = useCallback(() => {
    const name = window.prompt('Name for the new layout:');

    if (name && name.trim().length > 0) {
      createLayout(name.trim()).catch((err) =>
        console.error('handleCreate: failed', err),
      );
    }

    setOpen(false);
  }, [createLayout]);

  const handleDuplicate = useCallback(
    (layoutId: string) => {
      const sourceLayout = layouts.find((l) => l.id === layoutId);
      const defaultName = sourceLayout ? `${sourceLayout.name} (copy)` : 'Copy';
      const name = window.prompt('Name for the duplicated layout:', defaultName);

      if (name && name.trim().length > 0) {
        duplicateLayout(layoutId, name.trim()).catch((err) =>
          console.error('handleDuplicate: failed', err),
        );
      }

      setOpen(false);
    },
    [layouts, duplicateLayout],
  );

  const handleStartRename = useCallback((layoutId: string, currentName: string) => {
    setRenamingId(layoutId);
    setRenameValue(currentName);

    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  }, []);

  const handleFinishRename = useCallback(
    (layoutId: string) => {
      const trimmed = renameValue.trim();

      if (trimmed.length > 0 && trimmed !== layouts.find((l) => l.id === layoutId)?.name) {
        void renameLayout(layoutId, trimmed);
      }

      setRenamingId(null);
      setRenameValue('');
    },
    [renameValue, layouts, renameLayout],
  );

  const handleDelete = useCallback(
    (layoutId: string) => {
      const layout = layouts.find((l) => l.id === layoutId);
      const confirmed = window.confirm(
        `Delete "${layout?.name ?? 'Untitled'}"? This cannot be undone.`,
      );

      if (confirmed) {
        void deleteLayout(layoutId);
      }

      setOpen(false);
    },
    [layouts, deleteLayout],
  );

  if (!isEditMode) {
    return <span className="text-muted-foreground ml-2 text-xs">{activeName}</span>;
  }

  return (
    <div className="relative ml-2">
      <Button type="button" variant="outline" size="sm" onClick={handleToggle} className="gap-1">
        <span className="max-w-24 truncate">{activeName}</span>
        <svg
          className={cn('size-3 transition-transform', open && 'rotate-180')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="bg-popover text-popover-foreground border-border absolute top-full right-0 z-50 mt-1 w-56 rounded-lg border p-1 shadow-lg">
            <div className="text-muted-foreground mb-1 px-2 py-1 text-xs font-medium uppercase tracking-wider">
              Layouts
            </div>

            {layouts.map((layout) => (
              <div key={layout.id} className="group">
                {renamingId === layout.id ? (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <input
                      ref={renameInputRef}
                      className="bg-background border-border h-7 flex-1 rounded border px-2 text-sm outline-none"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleFinishRename(layout.id);
                        }

                        if (e.key === 'Escape') {
                          setRenamingId(null);
                          setRenameValue('');
                        }
                      }}
                      onBlur={() => handleFinishRename(layout.id)}
                    />
                  </div>
                ) : (
                  <>
                    <div
                      className={cn(
                        'flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors',
                        layout.id === activeLayoutId
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted',
                      )}
                      onClick={() => handleSelect(layout.id)}
                    >
                      <span className="truncate">{layout.name}</span>
                      <div className="flex items-center gap-0.5">
                        {layout.id === activeLayoutId && (
                          <svg
                            className="size-3.5 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-0.5 px-2 pb-1">
                      <button
                        className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(layout.id);
                        }}
                      >
                        Duplicate
                      </button>
                      <button
                        className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(layout.id, layout.name);
                        }}
                      >
                        Rename
                      </button>
                      {layouts.length > 1 && (
                        <button
                          className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(layout.id);
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}

            <div className="bg-border my-1 mx-2 h-px" />

            {!maxLayoutsReached && (
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                onClick={handleCreate}
              >
                <svg
                  className="size-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Layout
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
