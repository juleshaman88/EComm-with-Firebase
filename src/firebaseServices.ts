import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, db } from './firebaseConfig';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  address: string;
  isAdmin?: boolean;
}

export interface ProductInput {
  title: string;
  price: number;
  category: string;
  description: string;
  image: string;
}

export interface ProductRecord extends ProductInput {
  id: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  category: string;
  image: string;
  quantity: number;
}

export interface OrderRecord {
  id: string;
  userId: string;
  userEmail: string;
  items: OrderItem[];
  totalPrice: number;
  createdAt?: Date;
}

function timestampToDate(value: Timestamp | Date | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  return value.toDate();
}

export async function registerWithEmail(email: string, password: string): Promise<User> {
  const credentials = await createUserWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, 'users', credentials.user.uid), {
    uid: credentials.user.uid,
    email,
    name: '',
    address: '',
    isAdmin: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return credentials.user;
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const credentials = await signInWithEmailAndPassword(auth, email, password);
  return credentials.user;
}

export async function logoutCurrentUser(): Promise<void> {
  await signOut(auth);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const profileSnapshot = await getDoc(doc(db, 'users', uid));

  if (!profileSnapshot.exists()) {
    return null;
  }

  return profileSnapshot.data() as UserProfile;
}

export async function upsertUserProfile(
  uid: string,
  data: Pick<UserProfile, 'email' | 'name' | 'address'>,
): Promise<void> {
  await setDoc(
    doc(db, 'users', uid),
    {
      uid,
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteUserData(uid: string): Promise<void> {
  const ordersQuery = query(collection(db, 'orders'), where('userId', '==', uid));
  const orderSnapshots = await getDocs(ordersQuery);

  await Promise.all(orderSnapshots.docs.map(async (orderDoc) => deleteDoc(orderDoc.ref)));
  await deleteDoc(doc(db, 'users', uid));
}

export async function deleteCurrentUserAccount(): Promise<void> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('No active user session found.');
  }

  await deleteUserData(currentUser.uid);
  await deleteUser(currentUser);
}

export async function fetchProductsFromFirestore(): Promise<ProductRecord[]> {
  const snapshot = await getDocs(collection(db, 'products'));

  return snapshot.docs
    .map((item) => {
      const data = item.data() as Omit<ProductRecord, 'id'> & {
        createdAt?: Timestamp;
        updatedAt?: Timestamp;
      };

      return {
        id: item.id,
        title: data.title,
        price: Number(data.price),
        category: data.category,
        description: data.description,
        image: data.image,
        createdBy: data.createdBy,
        createdAt: timestampToDate(data.createdAt),
        updatedAt: timestampToDate(data.updatedAt),
      };
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export async function createProductInFirestore(
  payload: ProductInput,
  createdBy: string,
): Promise<void> {
  await addDoc(collection(db, 'products'), {
    ...payload,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateProductInFirestore(
  productId: string,
  payload: ProductInput,
): Promise<void> {
  await updateDoc(doc(db, 'products', productId), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  await deleteDoc(doc(db, 'products', productId));
}

export async function createOrderInFirestore(
  user: Pick<User, 'uid' | 'email'>,
  items: OrderItem[],
  totalPrice: number,
): Promise<void> {
  await addDoc(collection(db, 'orders'), {
    userId: user.uid,
    userEmail: user.email ?? '',
    items,
    totalPrice,
    createdAt: serverTimestamp(),
  });
}

export async function fetchUserOrders(uid: string): Promise<OrderRecord[]> {
  const ordersQuery = query(collection(db, 'orders'), where('userId', '==', uid));
  const snapshot = await getDocs(ordersQuery);

  return snapshot.docs
    .map((orderDoc) => {
      const data = orderDoc.data() as Omit<OrderRecord, 'id'> & { createdAt?: Timestamp };

      return {
        id: orderDoc.id,
        userId: data.userId,
        userEmail: data.userEmail,
        items: data.items,
        totalPrice: Number(data.totalPrice),
        createdAt: timestampToDate(data.createdAt),
      };
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}
