import {
  collection,
  onSnapshot,
  query,
  doc,
  setDoc,
  deleteDoc,
  DocumentData,
  WithFieldValue,
  QueryConstraint,
  FirestoreError,
} from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';

type UseFirebaseProps = {
  collectionName: string;
  constraints?: QueryConstraint[];
  constraintsKey?: string;
};

export type WithId<T> = T & { id: string };

export const useFirebase = <T extends DocumentData>({
  collectionName,
  constraints = [],
  constraintsKey = '',
}: UseFirebaseProps) => {
  const [data, setData] = useState<Array<WithId<T>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  const q = useMemo(() => {
    const ref = collection(db, collectionName);
    return query(ref, ...constraints);
    // NOTE: depend on constraintsKey (caller controls when meaning changes)
  }, [collectionName, constraintsKey]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items: Array<WithId<T>> = [];
        snap.forEach((d) => items.push({ id: d.id, ...(d.data() as T) }));
        setData(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.log('Firestore onSnapshot error:', err.code, err.message);
        setError(err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [q]);

  const add = useCallback(
    async (item: WithFieldValue<T>) => {
      const ref = doc(collection(db, collectionName));
      await setDoc(ref, item as DocumentData);
      return ref.id;
    },
    [collectionName],
  );

  const set = useCallback(
    async (id: string, item: WithFieldValue<T>) => {
      await setDoc(doc(db, collectionName, id), item as DocumentData, {
        merge: true,
      });
    },
    [collectionName],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteDoc(doc(db, collectionName, id));
    },
    [collectionName],
  );

  return { data, loading, error, add, set, remove };
};
