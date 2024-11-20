interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
}

let products: Product[] = [
  {
    id: '1',
    name: 'Laptop',
    description: 'A high-performance laptop',
    price: 1500,
  },
  {
    id: '2',
    name: 'Smartphone',
    description: 'A latest model smartphone',
    price: 800,
  },
  {
    id: '3',
    name: 'Headphones',
    description: 'Noise-cancelling headphones',
    price: 200,
  },
];

/**
 * Fetches a product by its ID.
 * @param id The ID of the product.
 * @returns The product if found, otherwise null.
 */
export async function fetchProductById(id: string): Promise<Product | null> {
  const product = products.find((p) => p.id === id);
  return product || null;
}

/**
 * Adds a new product to the list.
 * @param product The product data to add.
 * @returns The newly added product.
 */
export async function addProduct(
  product: Omit<Product, 'id'>
): Promise<Product> {
  const newProduct: Product = {
    id: (products.length + 1).toString(),
    ...product,
  };
  products.push(newProduct);
  return newProduct;
}

/**
 * Modifies an existing product.
 * @param id The ID of the product to modify.
 * @param updates The updates to apply.
 * @returns The updated product if found, otherwise null.
 */
export async function modifyProduct(
  id: string,
  updates: Partial<Omit<Product, 'id'>>
): Promise<Product | null> {
  const product = products.find((p) => p.id === id);
  if (product) {
    Object.assign(product, updates);
    return product;
  }
  return null;
}

/**
 * Removes a product by its ID.
 * @param id The ID of the product to remove.
 */
export async function removeProduct(id: string): Promise<void> {
  products = products.filter((p) => p.id !== id);
}
