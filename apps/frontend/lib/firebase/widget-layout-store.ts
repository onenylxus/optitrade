import { doc, getDoc, serverTimestamp, setDoc } from '@firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase/client';

const WIDGET_LAYOUT_COLLECTION = 'widget_layouts';

interface WidgetLayoutDoc {
  layout: string;
}

export async function loadWidgetLayoutString(userId: string): Promise<string | null> {
  const db = getFirebaseDb();
  const docRef = doc(db, WIDGET_LAYOUT_COLLECTION, userId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as Partial<WidgetLayoutDoc>;
  return typeof data.layout === 'string' ? data.layout : null;
}

export async function saveWidgetLayoutString(userId: string, layout: string): Promise<void> {
  const db = getFirebaseDb();
  const docRef = doc(db, WIDGET_LAYOUT_COLLECTION, userId);

  await setDoc(
    docRef,
    {
      layout,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
