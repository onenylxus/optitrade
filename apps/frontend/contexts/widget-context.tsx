'use client';

import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

interface WidgetContextValue {
  isEditMode: boolean;
  onDelete?: () => void;
}

const WidgetContext = createContext<WidgetContextValue>({
  isEditMode: false,
});

interface WidgetProviderProps extends WidgetContextValue {
  children: ReactNode;
}

export function WidgetProvider({ isEditMode, onDelete, children }: WidgetProviderProps) {
  return (
    <WidgetContext.Provider value={{ isEditMode, onDelete }}>{children}</WidgetContext.Provider>
  );
}

export function useWidgetContext() {
  return useContext(WidgetContext);
}
