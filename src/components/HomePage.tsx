import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { User } from 'firebase/auth';
import { useSelector } from 'react-redux';
import type { RootState } from '../redux/store';
import Categories from './Categories';
import Products from './Products';
import ProductDetail from './ProductDetail';
import NavBar from './NavBar';
import type { CartItem, Product } from '../redux/cartSlice';
import { useDispatch } from 'react-redux';
import {
  clearCart,
  decreaseCartItemQuantity,
  increaseCartItemQuantity,
  removeFromCart,
} from '../redux/cartSlice';
import {
  fetchCategoriesFromFakeStore,
  createOrderInFirestore,
  createProductInFirestore,
  deleteCurrentUserAccount,
  deleteProductFromFirestore,
  fetchProductsFromFirestore,
  fetchUserOrders,
  getUserProfile,
  logoutCurrentUser,
  updateProductInFirestore,
  upsertUserProfile,
  type OrderRecord,
  type ProductInput,
} from '../firebaseServices';

interface HomePageProps {
  user: User;
}

const initialProductForm: ProductInput = {
  title: '',
  price: 0,
  category: '',
  description: '',
  image: '',
};

export default function HomePage({ user }: HomePageProps) {
  const dispatch = useDispatch();
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const [view, setView] = useState<'home' | 'cart' | 'orders' | 'profile'>('home');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [productForm, setProductForm] = useState<ProductInput>(initialProductForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [uiMessage, setUiMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedImageName, setSelectedImageName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const {
    data: fakeStoreCategories = [],
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = useQuery({
    queryKey: ['fakestore-categories'],
    queryFn: fetchCategoriesFromFakeStore,
    staleTime: 1000 * 60 * 10,
  });

  const isFakeStoreProduct = (productId: string) => productId.startsWith('fakestore-');
  const isPermissionDeniedError = (error: unknown) => {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'permission-denied';
  };

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'all') {
      return products;
    }

    return products.filter((item) => item.category === selectedCategory);
  }, [products, selectedCategory]);

  const categories = useMemo(() => {
    const localCategories = products.map((item) => item.category);
    return Array.from(new Set([...fakeStoreCategories, ...localCategories])).filter(Boolean);
  }, [products, fakeStoreCategories]);

  const categoryErrorMessage =
    categoriesError instanceof Error
      ? categoriesError.message
      : categoriesError
        ? 'Unable to load categories from FakeStore API.'
        : '';

  const displayErrorMessage = errorMessage || categoryErrorMessage;

  const totalItems = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems],
  );

  const totalPrice = useMemo(
    () => cartItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [cartItems],
  );

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoadingData(true);
        setErrorMessage('');
        const [
          profileResult,
          firestoreProductsResult,
          firestoreOrdersResult,
        ] = await Promise.allSettled([
          getUserProfile(user.uid),
          fetchProductsFromFirestore(),
          fetchUserOrders(user.uid),
        ]);

        let profile = null;
        if (profileResult.status === 'fulfilled') {
          profile = profileResult.value;
        } else if (!isPermissionDeniedError(profileResult.reason)) {
          throw profileResult.reason;
        }

        let firestoreProducts: Product[] = [];
        if (firestoreProductsResult.status === 'fulfilled') {
          firestoreProducts = firestoreProductsResult.value;
        } else if (!isPermissionDeniedError(firestoreProductsResult.reason)) {
          throw firestoreProductsResult.reason;
        }

        let firestoreOrders: OrderRecord[] = [];
        if (firestoreOrdersResult.status === 'fulfilled') {
          firestoreOrders = firestoreOrdersResult.value;
        } else if (!isPermissionDeniedError(firestoreOrdersResult.reason)) {
          throw firestoreOrdersResult.reason;
        }

        if (profile) {
          setProfileName(profile.name ?? '');
          setProfileAddress(profile.address ?? '');
        }

        setProducts(firestoreProducts);
        setOrders(firestoreOrders);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load app data.');
      } finally {
        setIsLoadingData(false);
      }
    }

    loadData();
  }, [user.uid]);

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      return;
    }

    try {
      setUiMessage('');
      setErrorMessage('');
      const orderItems = cartItems.map((item) => ({
        productId: item.id,
        title: item.title,
        price: item.price,
        category: item.category,
        image: item.image,
        quantity: item.quantity,
      }));

      await createOrderInFirestore(user, orderItems, totalPrice);
      dispatch(clearCart());
      setUiMessage('Order placed successfully.');

      try {
        const refreshedOrders = await fetchUserOrders(user.uid);
        setOrders(refreshedOrders);
      } catch (refreshError) {
        if (!isPermissionDeniedError(refreshError)) {
          throw refreshError;
        }
      }
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        setUiMessage('Order sync is blocked by Firestore permissions. Update rules to store orders in Firebase.');
        return;
      }

      setErrorMessage(error instanceof Error ? error.message : 'Unable to place order.');
    }
  };

  const resetProductForm = () => {
    setProductForm(initialProductForm);
    setEditingProductId(null);
    setSelectedImageName('');
  };

  const handleProductImageSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file.');
      return;
    }

    if (selectedFile.size > 2 * 1024 * 1024) {
      setErrorMessage('Please select an image smaller than 2MB.');
      return;
    }

    const fileReader = new FileReader();

    fileReader.onload = () => {
      if (typeof fileReader.result !== 'string') {
        return;
      }

      setProductForm((prev) => ({ ...prev, image: fileReader.result as string }));
      setSelectedImageName(selectedFile.name);
      setErrorMessage('');
    };

    fileReader.onerror = () => {
      setErrorMessage('Unable to process image. Please choose a different file.');
    };

    fileReader.readAsDataURL(selectedFile);
  };

  const handleSaveProduct = async () => {
    if (!productForm.title || !productForm.category || !productForm.description || !productForm.image) {
      setErrorMessage('Please fill in all product fields.');
      return;
    }

    if (productForm.price <= 0) {
      setErrorMessage('Product price must be greater than zero.');
      return;
    }

    try {
      setIsSavingProduct(true);
      setErrorMessage('');
      setUiMessage('');

      if (editingProductId) {
        if (isFakeStoreProduct(editingProductId)) {
          setErrorMessage('FakeStore products are read-only. Create a new product to customize it.');
          return;
        }

        await updateProductInFirestore(editingProductId, productForm);
        setUiMessage('Product updated successfully.');
      } else {
        await createProductInFirestore(productForm, user.uid);
        setUiMessage('Product created successfully.');
      }

      const refreshedProducts = await fetchProductsFromFirestore();
      setProducts(refreshedProducts);
      resetProductForm();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save product.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    if (isFakeStoreProduct(product.id)) {
      setErrorMessage('FakeStore products are read-only. Create a new product to customize it.');
      return;
    }

    setProductForm({
      title: product.title,
      price: product.price,
      category: product.category,
      description: product.description,
      image: product.image,
    });
    setSelectedImageName('Current saved image');
    setEditingProductId(product.id);
  };

  const handleEditFromDetail = (product: Product) => {
    handleEditProduct(product);
    setSelectedProduct(null);
    setView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteProduct = async (productId: string) => {
    if (isFakeStoreProduct(productId)) {
      setErrorMessage('FakeStore products are read-only and cannot be deleted here.');
      return false;
    }

    const shouldDelete = window.confirm('Delete this product permanently?');

    if (!shouldDelete) {
      return false;
    }

    try {
      setErrorMessage('');
      await deleteProductFromFirestore(productId);
      setProducts((currentProducts) => currentProducts.filter((item) => item.id !== productId));
      setUiMessage('Product deleted successfully.');
      if (selectedProduct?.id === productId) {
        setSelectedProduct(null);
      }
      return true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete product.');
      return false;
    }
  };

  const handleDeleteFromDetail = async (productId: string) => {
    const wasDeleted = await handleDeleteProduct(productId);

    if (wasDeleted) {
      setSelectedProduct(null);
      setView('home');
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);
      setErrorMessage('');
      await upsertUserProfile(user.uid, {
        email: user.email ?? '',
        name: profileName,
        address: profileAddress,
      });
      setUiMessage('Profile updated successfully.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    const shouldDelete = window.confirm('This will delete your account and profile data. Continue?');

    if (!shouldDelete) {
      return;
    }

    try {
      setErrorMessage('');
      await deleteCurrentUserAccount();
      setUiMessage('Your account was deleted successfully.');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `${error.message}. If this fails due to auth age, sign in again and retry.`
          : 'Unable to delete account.',
      );
    }
  };

  const handleLogout = async () => {
    try {
      await logoutCurrentUser();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to logout.');
    }
  };

  const handleNavigate = (nextView: 'home' | 'cart' | 'orders' | 'profile') => {
    setView(nextView);
    setSelectedProduct(null);
    setSelectedOrder(null);
    setUiMessage('');
  };

  if (isLoadingData) {
    return <p className="status-message">Loading your dashboard...</p>;
  }

  return (
    <div className="app-shell">
      <NavBar userEmail={user.email ?? user.uid} onNavigate={handleNavigate} onLogout={handleLogout} />
      {uiMessage ? <p className="status-message success-message">{uiMessage}</p> : null}
      {displayErrorMessage ? <p className="status-message error-message">{displayErrorMessage}</p> : null}
      {selectedProduct ? (
        <ProductDetail
          product={selectedProduct}
          onBack={() => setSelectedProduct(null)}
          onEditProduct={handleEditFromDetail}
          onDeleteProduct={handleDeleteFromDetail}
        />
      ) : view === 'home' ? (
        <main className="home-view">
          <header className="hero-section">
            <h1>Your E-Commerce App</h1>
            <p>
              Browse all of our great products to find your next favorite item. You can also create, edit, and delete your own products if you have the right permissions.
            </p>
            <Categories
              categories={categories}
              selectedCategory={selectedCategory}
              onChange={setSelectedCategory}
            />
            {isLoadingCategories ? <p>Loading categories...</p> : null}
          </header>

          <section className="panel">
            <h2>{editingProductId ? 'Update Product' : 'Create Product'}</h2>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="product-title">Product Title</label>
                <input
                  id="product-title"
                  value={productForm.title}
                  placeholder="Ex: Wireless Headphones"
                  onChange={(event) => setProductForm((prev) => ({ ...prev, title: event.target.value }))}
                />
              </div>
              <div className="form-field">
                <label htmlFor="product-category">Category</label>
                <input
                  id="product-category"
                  value={productForm.category}
                  placeholder="Ex: electronics"
                  onChange={(event) => setProductForm((prev) => ({ ...prev, category: event.target.value }))}
                />
              </div>
              <div className="form-field">
                <label htmlFor="product-price">Price (USD)</label>
                <input
                  id="product-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.price}
                  placeholder="0.00"
                  onChange={(event) => setProductForm((prev) => ({ ...prev, price: Number(event.target.value) }))}
                />
              </div>
              <div className="form-field form-field-wide">
                <label htmlFor="product-image">Product Image Upload</label>
                <input
                  id="product-image"
                  type="file"
                  accept="image/*"
                  onChange={handleProductImageSelection}
                />
                {selectedImageName ? <small>Selected: {selectedImageName}</small> : null}
                {productForm.image ? (
                  <img
                    className="product-image-preview"
                    src={productForm.image}
                    alt="Selected product preview"
                  />
                ) : null}
              </div>
              <div className="form-field form-field-wide">
                <label htmlFor="product-description">Description</label>
                <textarea
                  id="product-description"
                  value={productForm.description}
                  placeholder="Describe the product"
                  onChange={(event) => setProductForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
            </div>
            <div className="action-row">
              <button type="button" onClick={handleSaveProduct} disabled={isSavingProduct}>
                {isSavingProduct ? 'Saving...' : editingProductId ? 'Update Product' : 'Create Product'}
              </button>
              {editingProductId ? (
                <button type="button" className="secondary-button" onClick={resetProductForm}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </section>

          <Products
            products={filteredProducts}
            selectedCategory={selectedCategory}
            onSelectProduct={setSelectedProduct}
          />
        </main>
      ) : view === 'profile' ? (
        <main className="panel">
          <h2>Your Profile</h2>
          <div className="form-grid">
            <input value={user.email ?? ''} disabled />
            <input
              value={profileName}
              placeholder="Name"
              onChange={(event) => setProfileName(event.target.value)}
            />
            <textarea
              value={profileAddress}
              placeholder="Address"
              onChange={(event) => setProfileAddress(event.target.value)}
            />
          </div>
          <div className="action-row">
            <button type="button" onClick={handleSaveProfile} disabled={isSavingProfile}>
              {isSavingProfile ? 'Saving...' : 'Save profile'}
            </button>
            <button type="button" className="danger-button" onClick={handleDeleteAccount}>
              Delete account
            </button>
          </div>
        </main>
      ) : view === 'orders' ? (
        <main className="panel">
          <h2>Your Order History</h2>
          {selectedOrder ? (
            <section>
              <button type="button" className="secondary-button" onClick={() => setSelectedOrder(null)}>
                Back to orders
              </button>
              <h3>Order {selectedOrder.id}</h3>
              <p>
                Date: {selectedOrder.createdAt ? selectedOrder.createdAt.toLocaleString() : 'Unknown'}
              </p>
              <p>Total: ${selectedOrder.totalPrice.toFixed(2)}</p>
              <div className="cart-list">
                {selectedOrder.items.map((item) => (
                  <article key={`${selectedOrder.id}-${item.productId}`} className="cart-item">
                    <img src={item.image} alt={item.title} />
                    <div>
                      <h3>{item.title}</h3>
                      <p>Quantity: {item.quantity}</p>
                      <p>Category: {item.category}</p>
                    </div>
                    <p>${(item.price * item.quantity).toFixed(2)}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : orders.length === 0 ? (
            <p>You have no previous orders.</p>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <article className="order-history-item" key={order.id}>
                  <div className="order-history-meta">
                    <h3>Order ID: {order.id}</h3>
                    <p>Date: {order.createdAt ? order.createdAt.toLocaleString() : 'Unknown'}</p>
                    <p>Total: ${order.totalPrice.toFixed(2)}</p>
                  </div>
                  <button type="button" className="view-order-button" onClick={() => setSelectedOrder(order)}>
                    View details
                  </button>
                </article>
              ))}
            </div>
          )}
        </main>
      ) : (
        <main className="cart-view">
          <h2>Your Cart</h2>
          <p>Total items: {totalItems}</p>
          <p>Total price: ${totalPrice.toFixed(2)}</p>
          {cartItems.length === 0 ? (
            <p>Your cart is empty.</p>
          ) : (
            <div className="cart-list">
              {cartItems.map((item: CartItem) => (
                <article className="cart-item" key={item.id}>
                  <img src={item.image} alt={item.title} onError={(event) => {
                    event.currentTarget.src = 'https://via.placeholder.com/120x120?text=No+Image';
                  }} />
                  <div>
                    <h3>{item.title}</h3>
                    <div className="cart-quantity-controls" aria-label={`Adjust quantity for ${item.title}`}>
                      <span>Quantity:</span>
                      <button type="button" onClick={() => dispatch(decreaseCartItemQuantity(item.id))}>
                        -
                      </button>
                      <strong>{item.quantity}</strong>
                      <button type="button" onClick={() => dispatch(increaseCartItemQuantity(item.id))}>
                        +
                      </button>
                    </div>
                    <p>Price: ${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                  <button type="button" onClick={() => dispatch(removeFromCart(item.id))}>
                    Remove
                  </button>
                </article>
              ))}
            </div>
          )}
          <button type="button" className="checkout-button" onClick={handleCheckout} disabled={cartItems.length === 0}>
            Place order
          </button>
        </main>
      )}
    </div>
  );
}
