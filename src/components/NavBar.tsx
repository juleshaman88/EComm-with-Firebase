import { useSelector } from 'react-redux';
import type { RootState } from '../redux/store';

interface NavBarProps {
  userEmail: string;
  onNavigate: (view: 'home' | 'cart' | 'orders' | 'profile') => void;
  onLogout: () => void;
}

export default function NavBar({ userEmail, onNavigate, onLogout }: NavBarProps) {
  const cartCount = useSelector((state: RootState) => state.cart.items.reduce((total, item) => total + item.quantity, 0));

  return (
    <nav className="navbar">
      <span className="user-email">Signed in: {userEmail}</span>
      <button type="button" onClick={() => onNavigate('home')}>
        Home
      </button>
      <button type="button" onClick={() => onNavigate('profile')}>
        Profile
      </button>
      <button type="button" onClick={() => onNavigate('cart')}>
        Cart ({cartCount})
      </button>
      <button type="button" onClick={() => onNavigate('orders')}>
        Orders
      </button>
      <button type="button" className="danger-button" onClick={onLogout}>
        Logout
      </button>
    </nav>
  );
}
