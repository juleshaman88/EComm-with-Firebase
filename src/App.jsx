import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { useDispatch, useSelector } from 'react-redux';
import HomePage from './components/HomePage';
import AuthPage from './components/AuthPage';
import { auth } from './firebaseConfig';
import { clearCart, hydrateCart } from './redux/cartSlice';
import type { AppDispatch, RootState } from './redux/store';
import './App.css';

function App() {
  const dispatch = useDispatch<AppDispatch>();
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      dispatch(clearCart());
      return;
    }

    const cartKey = `cart-${currentUser.uid}`;
    const savedCart = sessionStorage.getItem(cartKey);

    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart) as typeof cartItems;
        dispatch(hydrateCart(parsedCart));
      } catch {
        sessionStorage.removeItem(cartKey);
      }
    }
  }, [currentUser, dispatch]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    sessionStorage.setItem(`cart-${currentUser.uid}`, JSON.stringify(cartItems));
  }, [cartItems, currentUser]);

  if (isAuthLoading) {
    return <p className="status-message">Checking your session...</p>;
  }

  if (!currentUser) {
    return <AuthPage />;
  }

  return <HomePage user={currentUser} />;
}

export default App;
