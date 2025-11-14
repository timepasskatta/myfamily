import { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  Query
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';

export function useFirestoreCollection<T>(collectionName: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [user] = useAuthState(auth);

  useEffect(() => {
    if (!user) {
        setData([]);
        setLoading(false);
        return;
    };

    setLoading(true);
    const collectionPath = `userData/${user.uid}/${collectionName}`;
    const collRef = collection(db, collectionPath);

    // The 'categories' collection does not have a 'date' field, so we only apply
    // sorting to the 'transactions' collection to avoid Firestore errors.
    const q: Query = collectionName === 'transactions' 
      ? query(collRef, orderBy('date', 'desc'))
      : query(collRef);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const items: T[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as T);
      });
      setData(items);
      setLoading(false);
    }, (error) => {
        console.error(`Error fetching ${collectionName}: `, error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, collectionName]);

  const addDocument = async (item: Omit<T, 'id'>) => {
    if (!user) throw new Error("User not authenticated");
    const collectionPath = `userData/${user.uid}/${collectionName}`;
    return await addDoc(collection(db, collectionPath), {
        ...item,
        // Add a server timestamp for creation if not provided
        createdAt: serverTimestamp(),
    });
  };

  const updateDocument = async (id: string, item: Partial<T>) => {
    if (!user) throw new Error("User not authenticated");
    const docPath = `userData/${user.uid}/${collectionName}/${id}`;
    return await updateDoc(doc(db, docPath), item);
  };

  const deleteDocument = async (id: string) => {
    if (!user) throw new Error("User not authenticated");
    const docPath = `userData/${user.uid}/${collectionName}/${id}`;
    return await deleteDoc(doc(db, docPath));
  };
  
  const addDocumentsBatch = async (items: Omit<T, 'id'>[]) => {
    if (!user) throw new Error("User not authenticated");
    const collectionPath = `userData/${user.uid}/${collectionName}`;
    const collectionRef = collection(db, collectionPath);
    const batch = writeBatch(db);

    items.forEach(item => {
        const docRef = doc(collectionRef);
        batch.set(docRef, item);
    });
    
    await batch.commit();
  }

  return { data, loading, addDocument, updateDocument, deleteDocument, addDocumentsBatch };
}