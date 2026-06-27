import { deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from '@firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase/client';

const WIDGET_LAYOUT_COLLECTION = 'widget_layouts';

export interface LayoutMeta {
  id: string;
  name: string;
  order: number;
}

export interface UserLayoutsMeta {
  activeLayoutId: string | null;
  layouts: LayoutMeta[];
}

interface LayoutEntry {
  name: string;
  layout: string;
  order: number;
}

function parseLayoutsMeta(
  activeLayoutId: string,
  layoutsMap: Record<string, unknown>,
): UserLayoutsMeta {
  const layouts: LayoutMeta[] = [];

  for (const [id, entry] of Object.entries(layoutsMap)) {
    if (entry && typeof entry === 'object') {
      const e = entry as Partial<LayoutEntry>;

      if (typeof e.name === 'string') {
        layouts.push({
          id,
          name: e.name,
          order: typeof e.order === 'number' ? e.order : 0,
        });
      } else if (id) {
        layouts.push({
          id,
          name: 'Untitled',
          order: typeof e.order === 'number' ? e.order : 0,
        });
      }
    }
  }

  layouts.sort((a, b) => a.order - b.order);

  return { activeLayoutId, layouts };
}

export function getNextLayoutName(layouts: LayoutMeta[]): string {
  let maxNum = 0;
  const pattern = /^Layout (\d+)$/;

  for (const layout of layouts) {
    const match = layout.name.match(pattern);

    if (match) {
      maxNum = Math.max(maxNum, Number.parseInt(match[1], 10));
    }
  }

  return `Layout ${maxNum + 1}`;
}

export function generateLayoutId(): string {
  const randomSuffix = Math.random().toString(36).slice(2, 8);

  return `layout-${Date.now()}-${randomSuffix}`;
}

async function migrateOldLayoutFormat(userId: string, oldLayout: string): Promise<UserLayoutsMeta> {
  const db = getFirebaseDb();
  const docRef = doc(db, WIDGET_LAYOUT_COLLECTION, userId);

  await setDoc(
    docRef,
    {
      activeLayoutId: 'default',
      layouts: {
        default: {
          name: 'Default',
          layout: oldLayout,
          order: 0,
          updatedAt: serverTimestamp(),
        },
      },
      updatedAt: serverTimestamp(),
      layout: deleteField(),
    },
    { merge: true },
  );

  return {
    activeLayoutId: 'default',
    layouts: [{ id: 'default', name: 'Default', order: 0 }],
  };
}

export async function loadUserLayoutsMeta(userId: string): Promise<UserLayoutsMeta> {
  const db = getFirebaseDb();
  const docRef = doc(db, WIDGET_LAYOUT_COLLECTION, userId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return { activeLayoutId: null, layouts: [] };
  }

  const data = snapshot.data();

  if (!data.activeLayoutId && typeof data.layout === 'string') {
    return migrateOldLayoutFormat(userId, data.layout);
  }

  if (typeof data.activeLayoutId === 'string' && data.layouts && typeof data.layouts === 'object') {
    return parseLayoutsMeta(data.activeLayoutId, data.layouts as Record<string, unknown>);
  }

  return { activeLayoutId: null, layouts: [] };
}

export async function loadLayoutString(userId: string, layoutId: string): Promise<string | null> {
  const db = getFirebaseDb();
  const docRef = doc(db, WIDGET_LAYOUT_COLLECTION, userId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  const layouts = data.layouts as Record<string, LayoutEntry> | undefined;

  if (!layouts || !layouts[layoutId]) {
    return null;
  }

  return layouts[layoutId].layout ?? null;
}

export async function saveLayoutString(
  userId: string,
  layoutId: string,
  layout: string,
): Promise<void> {
  const db = getFirebaseDb();
  const docRef = doc(db, WIDGET_LAYOUT_COLLECTION, userId);

  await updateDoc(docRef, {
    [`layouts.${layoutId}.layout`]: layout,
    [`layouts.${layoutId}.updatedAt`]: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function setActiveLayout(userId: string, layoutId: string): Promise<void> {
  const db = getFirebaseDb();
  const docRef = doc(db, WIDGET_LAYOUT_COLLECTION, userId);

  await setDoc(
    docRef,
    {
      activeLayoutId: layoutId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function createNewLayout(
  userId: string,
  layoutId: string,
  name: string,
  layout: string,
  order: number,
): Promise<void> {
  const db = getFirebaseDb();
  const docRef = doc(db, WIDGET_LAYOUT_COLLECTION, userId);

  await setDoc(
    docRef,
    {
      layouts: {
        [layoutId]: {
          name,
          layout,
          order,
          updatedAt: serverTimestamp(),
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function renameLayout(userId: string, layoutId: string, name: string): Promise<void> {
  const db = getFirebaseDb();
  const docRef = doc(db, WIDGET_LAYOUT_COLLECTION, userId);

  await updateDoc(docRef, {
    [`layouts.${layoutId}.name`]: name,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteLayout(userId: string, layoutId: string): Promise<void> {
  const db = getFirebaseDb();
  const docRef = doc(db, WIDGET_LAYOUT_COLLECTION, userId);

  await updateDoc(docRef, {
    [`layouts.${layoutId}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
}
