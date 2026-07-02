import { useQuery } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { addToCart } from '../redux/cartSlice';
import type { Product } from '../redux/cartSlice';

interface ProductsProps {
  products: Product[];
  selectedCategory: string;
  onSelectProduct: (product: Product) => void;
}

interface FakeStoreApiProduct {
  id: number;
  title: string;
  price: number;
  category: string;
  description: string;
  image: string;
  rating?: {
    rate: number;
    count: number;
  };
}

export default function Products({
  products,
  selectedCategory,
  onSelectProduct,
}: ProductsProps) {
  const dispatch = useDispatch();

  const { data: fakeStoreProducts = [], isLoading, error } = useQuery<Product[]>({
    queryKey: ['products', selectedCategory],
    queryFn: async () => {
      const endpoint = selectedCategory && selectedCategory !== 'all'
        ? `https://fakestoreapi.com/products/category/${encodeURIComponent(selectedCategory)}`
        : 'https://fakestoreapi.com/products';

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = (await response.json()) as FakeStoreApiProduct[];
      return data.map((item) => ({
        id: `fakestore-${item.id}`,
        title: item.title,
        price: Number(item.price),
        category: item.category,
        description: item.description,
        image: item.image,
        rating: item.rating,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });

  const firestoreProducts =
    selectedCategory === 'all'
      ? products
      : products.filter((product) => product.category === selectedCategory);

  const combinedProducts = [...firestoreProducts, ...fakeStoreProducts];

  if (isLoading) {
    return <p>Loading products...</p>;
  }

  if (error) {
    return <p>Unable to load products right now.</p>;
  }

  if (combinedProducts.length === 0) {
    return <p>No products found in this category.</p>;
  }

  return (
    <div className="products-grid">
      {combinedProducts.map((product) => (
        <article className="product-card" key={product.id}>
          <img
            src={product.image}
            alt={product.title}
            onError={(event) => {
              event.currentTarget.src = 'https://via.placeholder.com/300x300?text=No+Image';
            }}
          />
          <h3>{product.title}</h3>
          <p className="rating">⭐ {product.rating?.rate ?? 'N/A'}</p>
          <p className="price">${product.price.toFixed(2)}</p>
          <div className="product-card-buttons">
            <button type="button" onClick={() => onSelectProduct(product)}>
              View Details
            </button>
            <button type="button" onClick={() => dispatch(addToCart(product))} className="add-to-cart-quick">
              Add to cart
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
