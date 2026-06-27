'use client';

import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { initialPlacements } from '@/app/(home)/fixtures';
import {
  createNewLayout,
  deleteLayout as deleteLayoutInStore,
  generateLayoutId,
  getNextLayoutName,
  loadLayoutString,
  loadUserLayoutsMeta,
  renameLayout as renameLayoutInStore,
  setActiveLayout,
  type LayoutMeta,
} from '@/lib/firebase/widget-layout-store';
import { serializeWidgetLayout } from '@/lib/widget-layout-serialization';

const MAX_LAYOUTS = 5;

export interface LayoutContextValue {
  layouts: LayoutMeta[];
  activeLayoutId: string | null;
  activeLayoutContent: string | null;
  isLayoutReady: boolean;
  switchLayout: (layoutId: string) => Promise<void>;
  createLayout: (name: string) => Promise<string | null>;
  duplicateLayout: (layoutId: string, name: string) => Promise<string | null>;
  renameLayout: (layoutId: string, name: string) => Promise<void>;
  deleteLayout: (layoutId: string) => Promise<void>;
  updateCachedLayoutContent: (layoutId: string, content: string) => void;
  maxLayoutsReached: boolean;
}

const LayoutContext = createContext<LayoutContextValue>({
  layouts: [],
  activeLayoutId: null,
  activeLayoutContent: null,
  isLayoutReady: true,
  switchLayout: async () => {},
  createLayout: async () => null,
  duplicateLayout: async () => null,
  renameLayout: async () => {},
  deleteLayout: async () => {},
  updateCachedLayoutContent: () => {},
  maxLayoutsReached: false,
});

interface LayoutProviderProps {
  userId: string | null;
  children: ReactNode;
}

export function LayoutProvider({ userId, children }: LayoutProviderProps) {
  const [layouts, setLayouts] = useState<LayoutMeta[]>([]);
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null);
  const [activeLayoutContent, setActiveLayoutContent] = useState<string | null>(null);
  const [isLayoutReady, setIsLayoutReady] = useState(!userId);
  const contentCacheRef = useRef<Map<string, string>>(new Map());

  const ensureActiveLayoutIsValid = useCallback(
    (currentLayouts: LayoutMeta[], currentActiveId: string | null): string | null => {
      if (!currentActiveId || !currentLayouts.some((l) => l.id === currentActiveId)) {
        const [firstLayout] = currentLayouts;
        return firstLayout ? firstLayout.id : null;
      }

      return currentActiveId;
    },
    [],
  );

  const loadContentForLayout = useCallback(
    async (uid: string, layoutId: string): Promise<string | null> => {
      const cached = contentCacheRef.current.get(layoutId);

      if (cached !== undefined) {
        return cached;
      }

      const content = await loadLayoutString(uid, layoutId);

      if (content !== null) {
        contentCacheRef.current.set(layoutId, content);
      }

      return content;
    },
    [],
  );

  useEffect(() => {
    if (!userId) {
      setLayouts([]);
      setActiveLayoutId(null);
      setActiveLayoutContent(null);
      contentCacheRef.current.clear();
      setIsLayoutReady(true);

      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const meta = await loadUserLayoutsMeta(userId);

        if (cancelled) {
          return;
        }

        if (meta.layouts.length === 0) {
          const layoutId = generateLayoutId();
          const initialLayout = serializeWidgetLayout(initialPlacements);

          await createNewLayout(userId, layoutId, 'Default', initialLayout, 0);
          await setActiveLayout(userId, layoutId);

          if (cancelled) {
            return;
          }

          contentCacheRef.current.set(layoutId, initialLayout);
          setLayouts([{ id: layoutId, name: 'Default', order: 0 }]);
          setActiveLayoutId(layoutId);
          setActiveLayoutContent(initialLayout);
        } else {
          const validActiveId = ensureActiveLayoutIsValid(meta.layouts, meta.activeLayoutId);
          const effectiveActiveId = validActiveId ?? meta.layouts[0]?.id ?? null;

          if (!validActiveId && effectiveActiveId) {
            await setActiveLayout(userId, effectiveActiveId);
          }

          if (cancelled) {
            return;
          }

          setLayouts(meta.layouts);
          setActiveLayoutId(effectiveActiveId);

          if (effectiveActiveId) {
            const content = await loadContentForLayout(userId, effectiveActiveId);
            setActiveLayoutContent(content);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLayoutReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, ensureActiveLayoutIsValid, loadContentForLayout]);

  const updateCachedLayoutContent = useCallback(
    (layoutId: string, content: string) => {
      contentCacheRef.current.set(layoutId, content);

      if (layoutId === activeLayoutId) {
        setActiveLayoutContent(content);
      }
    },
    [activeLayoutId],
  );

  const maxLayoutsReached = layouts.length >= MAX_LAYOUTS;

  const switchLayout = useCallback(
    async (layoutId: string) => {
      if (!userId || layoutId === activeLayoutId) {
        return;
      }

      setActiveLayoutId(layoutId);

      const cached = contentCacheRef.current.get(layoutId);

      if (cached !== undefined) {
        setActiveLayoutContent(cached);
      } else {
        setActiveLayoutContent(null);
      }

      await setActiveLayout(userId, layoutId);

      const content = await loadContentForLayout(userId, layoutId);
      setActiveLayoutContent(content);
    },
    [userId, activeLayoutId, loadContentForLayout],
  );

  const createLayoutFn = useCallback(
    async (name: string): Promise<string | null> => {
      if (!userId || maxLayoutsReached) {
        return null;
      }

      const layoutId = generateLayoutId();
      const order = layouts.length > 0 ? Math.max(...layouts.map((l) => l.order)) + 1 : 0;
      const defaultLayout = serializeWidgetLayout(initialPlacements);

      await createNewLayout(userId, layoutId, name, defaultLayout, order);

      contentCacheRef.current.set(layoutId, defaultLayout);

      const newLayout: LayoutMeta = { id: layoutId, name, order };
      setLayouts((prev) => [...prev, newLayout].sort((a, b) => a.order - b.order));

      return layoutId;
    },
    [userId, maxLayoutsReached, layouts],
  );

  const duplicateLayoutFn = useCallback(
    async (sourceId: string, name: string): Promise<string | null> => {
      if (!userId || maxLayoutsReached) {
        return null;
      }

      try {
        const sourceLayoutString = await loadLayoutString(userId, sourceId);

        if (!sourceLayoutString) {
          console.error('duplicateLayout: source layout content not found', sourceId);
          return null;
        }

        const layoutId = generateLayoutId();
        const order = layouts.length > 0 ? Math.max(...layouts.map((l) => l.order)) + 1 : 0;

        await createNewLayout(userId, layoutId, name, sourceLayoutString, order);

        contentCacheRef.current.set(layoutId, sourceLayoutString);

        const newLayout: LayoutMeta = { id: layoutId, name, order };
        setLayouts((prev) => [...prev, newLayout].sort((a, b) => a.order - b.order));

        return layoutId;
      } catch (err) {
        console.error('duplicateLayout: failed', err);
        return null;
      }
    },
    [userId, maxLayoutsReached, layouts],
  );

  const renameLayoutFn = useCallback(
    async (layoutId: string, name: string) => {
      if (!userId) {
        return;
      }

      await renameLayoutInStore(userId, layoutId, name);
      setLayouts((prev) => prev.map((l) => (l.id === layoutId ? { ...l, name } : l)));
    },
    [userId],
  );

  const deleteLayoutFn = useCallback(
    async (layoutId: string) => {
      if (!userId || layouts.length <= 1) {
        return;
      }

      await deleteLayoutInStore(userId, layoutId);
      contentCacheRef.current.delete(layoutId);

      setLayouts((prev) => prev.filter((l) => l.id !== layoutId));

      if (activeLayoutId === layoutId) {
        const remaining = layouts.filter((l) => l.id !== layoutId);
        const [firstRemaining] = remaining;

        if (firstRemaining) {
          setActiveLayoutId(firstRemaining.id);

          const cached = contentCacheRef.current.get(firstRemaining.id);

          if (cached !== undefined) {
            setActiveLayoutContent(cached);
          }

          await setActiveLayout(userId, firstRemaining.id);
        } else {
          setActiveLayoutId(null);
          setActiveLayoutContent(null);
        }
      }
    },
    [userId, layouts, activeLayoutId],
  );

  return (
    <LayoutContext.Provider
      value={{
        layouts,
        activeLayoutId,
        activeLayoutContent,
        isLayoutReady,
        switchLayout,
        createLayout: createLayoutFn,
        duplicateLayout: duplicateLayoutFn,
        renameLayout: renameLayoutFn,
        deleteLayout: deleteLayoutFn,
        updateCachedLayoutContent,
        maxLayoutsReached,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayoutContext(): LayoutContextValue {
  return useContext(LayoutContext);
}
