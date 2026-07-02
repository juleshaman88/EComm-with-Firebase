import { useQuery } from "@tanstack/react-query";

interface CategoriesProps {
  categories: string[];
  selectedCategory: string;
  onChange: (category: string) => void;
}

export default function Categories({ selectedCategory, onChange }: CategoriesProps) {
  const { data, isLoading, error } = useQuery<string[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('https://fakestoreapi.com/products/categories');
      if (!response.ok) {
        throw new Error('Failed to fetch categories');
      }
      return response.json() as Promise<string[]>;
    },
    staleTime: 1000 * 60 * 5,
  });

    return (
    <label className="category-select">
      <span>Filter by category</span>
      <select value={selectedCategory} onChange={(event) => onChange(event.target.value)}>
        <option value="all">All products</option>
        {!isLoading && !error && data?.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </label>
  );
}
