/**
 * Contrato del almacén de productos.
 * El comportamiento lo definen los tests de tests/practica-productos.
 * Implementen los métodos. No cambien las firmas ni los códigos de ProductError.
 */

export type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProductInput = {
  name: string;
  sku: string;
  price: number;
  stock?: number;
  category?: string | null;
};

export type UpdateProductInput = {
  name?: string;
  sku?: string;
  price?: number;
  stock?: number;
  category?: string | null;
  active?: boolean;
};

export type ListProductsQuery = {
  search?: string;
  category?: string;
  active?: boolean;
  minPrice?: number;
  maxPrice?: number;
};

export type ProductErrorCode = "VALIDATION" | "NOT_FOUND" | "DUPLICATE_SKU" | "INSUFFICIENT_STOCK";

export class ProductError extends Error {
  readonly code: ProductErrorCode;

  constructor(code: ProductErrorCode, message: string) {
    super(message);
    this.name = "ProductError";
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function pending(method: string): never {
  throw new Error(`ProductStore.${method} no está implementado`);
}

export class ProductStore {
  create(input: CreateProductInput): Product {
    void input;
    pending("create");
  }

  getById(id: string): Product | null {
    void id;
    pending("getById");
  }

  getBySku(sku: string): Product | null {
    void sku;
    pending("getBySku");
  }

  list(query?: ListProductsQuery): Product[] {
    void query;
    pending("list");
  }

  update(id: string, patch: UpdateProductInput): Product {
    void id;
    void patch;
    pending("update");
  }

  remove(id: string): boolean {
    void id;
    pending("remove");
  }

  adjustStock(id: string, delta: number): Product {
    void id;
    void delta;
    pending("adjustStock");
  }
}
