export class ProductError extends Error {
  static readonly VALIDATION = 'VALIDATION';
  static readonly DUPLICATE_SKU = 'DUPLICATE_SKU';
  static readonly NOT_FOUND = 'NOT_FOUND';
  static readonly INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK';

  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ProductError';
  }
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  name: unknown;
  sku: unknown;
  price: unknown;
  stock?: unknown;
  category?: unknown;
  active?: unknown;
}

export interface UpdateProductInput {
  name?: unknown;
  sku?: unknown;
  price?: unknown;
  stock?: unknown;
  category?: unknown;
  active?: unknown;
}

export interface ListProductsQuery {
  search?: unknown;
  category?: unknown;
  active?: unknown;
  minPrice?: unknown;
  maxPrice?: unknown;
}

export class ProductStore {
  private products: Map<string, Product> = new Map();

  private cloneProduct(product: Product): Product {
    return {
      ...product,
      createdAt: new Date(product.createdAt),
      updatedAt: new Date(product.updatedAt),
    };
  }

  private validateName(name: unknown): string {
    if (typeof name !== 'string') {
      throw new ProductError(ProductError.VALIDATION, 'El nombre debe ser un texto');
    }
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 80) {
      throw new ProductError(ProductError.VALIDATION, 'El nombre debe tener entre 1 y 80 caracteres');
    }
    return trimmed;
  }

  private validateSku(sku: unknown): string {
    if (typeof sku !== 'string') {
      throw new ProductError(ProductError.VALIDATION, 'El SKU debe ser un texto');
    }
    const trimmed = sku.trim().toUpperCase();
    const pattern = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
    if (trimmed.length < 2 || trimmed.length > 32 || !pattern.test(trimmed)) {
      throw new ProductError(ProductError.VALIDATION, 'SKU inválido');
    }
    return trimmed;
  }

  private validatePrice(price: unknown): number {
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) {
      throw new ProductError(ProductError.VALIDATION, 'El precio debe ser un número mayor o igual a 0');
    }
    return price;
  }

  private validateStock(stock: unknown, isOptional: boolean = false): number {
    if (stock === undefined && isOptional) {
      return 0;
    }
    if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0) {
      throw new ProductError(ProductError.VALIDATION, 'El stock debe ser un entero mayor o igual a 0');
    }
    return stock;
  }

  private validateCategory(category: unknown): string | null {
    if (category === undefined || category === null) {
      return null;
    }
    if (typeof category !== 'string') {
      throw new ProductError(ProductError.VALIDATION, 'La categoría debe ser un texto');
    }
    const trimmed = category.trim();
    return trimmed === '' ? null : trimmed;
  }

  create(input: CreateProductInput): Product {
    if (!input || typeof input !== 'object') {
      throw new ProductError(ProductError.VALIDATION, 'Input inválido');
    }

    const name = this.validateName(input.name);
    const sku = this.validateSku(input.sku);
    const price = this.validatePrice(input.price);
    const stock = this.validateStock(input.stock, true);
    const category = this.validateCategory(input.category);
    const active = input.active !== undefined ? Boolean(input.active) : true;

    for (const p of this.products.values()) {
      if (p.sku === sku) {
        throw new ProductError(ProductError.DUPLICATE_SKU, 'El SKU ya existe');
      }
    }

    const id = crypto.randomUUID();
    const now = new Date();

    const product: Product = {
      id,
      name,
      sku,
      price,
      stock,
      category,
      active,
      createdAt: now,
      updatedAt: now,
    };

    this.products.set(id, product);
    return this.cloneProduct(product);
  }

  getById(id: string): Product | null {
    if (typeof id !== 'string') return null;
    const product = this.products.get(id);
    return product ? this.cloneProduct(product) : null;
  }

  getBySku(sku: string): Product | null {
    if (typeof sku !== 'string') return null;
    const normalizedSku = sku.trim().toUpperCase();
    for (const p of this.products.values()) {
      if (p.sku === normalizedSku) {
        return this.cloneProduct(p);
      }
    }
    return null;
  }

  list(query?: ListProductsQuery): Product[] {
    let result = Array.from(this.products.values());

    if (query && typeof query === 'object') {
      const { search, category, active, minPrice, maxPrice } = query;

      let min: number | undefined;
      let max: number | undefined;

      if (minPrice !== undefined && minPrice !== null) {
        if (typeof minPrice !== 'number' || !Number.isFinite(minPrice) || minPrice < 0) {
          throw new ProductError(ProductError.VALIDATION, 'minPrice inválido');
        }
        min = minPrice;
      }

      if (maxPrice !== undefined && maxPrice !== null) {
        if (typeof maxPrice !== 'number' || !Number.isFinite(maxPrice) || maxPrice < 0) {
          throw new ProductError(ProductError.VALIDATION, 'maxPrice inválido');
        }
        max = maxPrice;
      }

      if (min !== undefined && max !== undefined && min > max) {
        throw new ProductError(ProductError.VALIDATION, 'minPrice no puede ser mayor que maxPrice');
      }

      if (min !== undefined) {
        result = result.filter(p => p.price >= min);
      }

      if (max !== undefined) {
        result = result.filter(p => p.price <= max);
      }

      if (search !== undefined && search !== null) {
        if (typeof search !== 'string') {
          throw new ProductError(ProductError.VALIDATION, 'search inválido');
        }
        const trimmedSearch = search.trim();
        if (trimmedSearch !== '') {
          const normalizeStr = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const lowerSearch = normalizeStr(trimmedSearch);
          result = result.filter(
            p => normalizeStr(p.name).includes(lowerSearch) || normalizeStr(p.sku).includes(lowerSearch)
          );
        }
      }

      if (category !== undefined && category !== null) {
        if (typeof category !== 'string') {
          throw new ProductError(ProductError.VALIDATION, 'category inválida');
        }
        const trimmedCat = category.trim();
        if (trimmedCat !== '') {
          const lowerCat = trimmedCat.toLowerCase();
          result = result.filter(p => p.category && p.category.toLowerCase() === lowerCat);
        }
      }

      if (active !== undefined && active !== null) {
        if (typeof active !== 'boolean') {
          throw new ProductError(ProductError.VALIDATION, 'active inválido');
        }
        result = result.filter(p => p.active === active);
      }
    }

    result.sort((a, b) => {
      const comp = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      if (comp !== 0) return comp;
      return a.sku.localeCompare(b.sku, 'es', { sensitivity: 'base' });
    });

    return result.map(p => this.cloneProduct(p));
  }

  update(id: string, patch: UpdateProductInput): Product {
    if (typeof id !== 'string' || !this.products.has(id)) {
      throw new ProductError(ProductError.NOT_FOUND, 'Producto no encontrado');
    }

    if (!patch || typeof patch !== 'object') {
      throw new ProductError(ProductError.VALIDATION, 'Patch inválido');
    }

    const existing = this.products.get(id)!;

    let newName = existing.name;
    let newSku = existing.sku;
    let newPrice = existing.price;
    let newStock = existing.stock;
    let newCategory = existing.category;
    let newActive = existing.active;

    if (patch.name !== undefined) {
      newName = this.validateName(patch.name);
    }

    if (patch.sku !== undefined) {
      newSku = this.validateSku(patch.sku);
      for (const [pId, p] of this.products.entries()) {
        if (pId !== id && p.sku === newSku) {
          throw new ProductError(ProductError.DUPLICATE_SKU, 'El SKU ya existe');
        }
      }
    }

    if (patch.price !== undefined) {
      newPrice = this.validatePrice(patch.price);
    }

    if (patch.stock !== undefined) {
      newStock = this.validateStock(patch.stock, false);
    }

    if (patch.category !== undefined) {
      newCategory = this.validateCategory(patch.category);
    }

    if (patch.active !== undefined) {
      if (typeof patch.active !== 'boolean') {
        throw new ProductError(ProductError.VALIDATION, 'active inválido');
      }
      newActive = patch.active;
    }

    const patchKeys = Object.keys(patch).filter(k => (patch as any)[k] !== undefined);
    if (patchKeys.length === 0) {
      return this.cloneProduct(existing);
    }

    const updated: Product = {
      ...existing,
      name: newName,
      sku: newSku,
      price: newPrice,
      stock: newStock,
      category: newCategory,
      active: newActive,
      updatedAt: new Date(),
    };

    this.products.set(id, updated);
    return this.cloneProduct(updated);
  }

  remove(id: string): boolean {
    if (typeof id !== 'string') return false;
    return this.products.delete(id);
  }

  adjustStock(id: string, delta: number): Product {
    if (typeof id !== 'string' || !this.products.has(id)) {
      throw new ProductError(ProductError.NOT_FOUND, 'Producto no encontrado');
    }

    if (typeof delta !== 'number' || !Number.isInteger(delta) || delta === 0) {
      throw new ProductError(ProductError.VALIDATION, 'El delta de stock debe ser un entero distinto de 0');
    }

    const existing = this.products.get(id)!;
    const newStock = existing.stock + delta;

    if (newStock < 0) {
      throw new ProductError(ProductError.INSUFFICIENT_STOCK, 'Stock insuficiente');
    }

    const updated: Product = {
      ...existing,
      stock: newStock,
      updatedAt: new Date(),
    };

    this.products.set(id, updated);
    return this.cloneProduct(updated);
  }
}