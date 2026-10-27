/**
 * Contrato del almacén de productos.
 * El comportamiento lo definen los tests de tests/practica-productos.
 * Implementen los métodos. No cambien las firmas ni los códigos de ProductError.
 */

import { randomUUID } from "node:crypto";

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

const SKU_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

function fail(code: ProductErrorCode, message: string): never {
  throw new ProductError(code, message);
}

function copyOf(product: Product): Product {
  return {
    ...product,
    createdAt: new Date(product.createdAt.getTime()),
    updatedAt: new Date(product.updatedAt.getTime()),
  };
}

function parseName(value: unknown): string {
  if (typeof value !== "string") fail("VALIDATION", "name must be a string");
  const name = value.trim();
  if (name.length < 1 || name.length > 80) {
    fail("VALIDATION", "name must have between 1 and 80 characters");
  }
  return name;
}

function parseSku(value: unknown): string {
  if (typeof value !== "string") fail("VALIDATION", "sku must be a string");
  const sku = value.trim().toUpperCase();
  if (sku.length < 2 || sku.length > 32 || !SKU_PATTERN.test(sku)) {
    fail("VALIDATION", "sku must have 2 to 32 characters and match [A-Z0-9] groups separated by '-'");
  }
  return sku;
}

function parsePrice(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail("VALIDATION", "price must be a finite number >= 0");
  }
  return value;
}

function parseStock(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail("VALIDATION", "stock must be an integer >= 0");
  }
  return value;
}

function parseCategory(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") fail("VALIDATION", "category must be a string or null");
  const category = value.trim();
  return category === "" ? null : category;
}

function parseActive(value: unknown): boolean {
  if (typeof value !== "boolean") fail("VALIDATION", "active must be a boolean");
  return value;
}

function parsePriceBound(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail("VALIDATION", `${label} must be a finite number >= 0`);
  }
  return value;
}

export class ProductStore {
  private readonly products = new Map<string, Product>();

  private findBySku(sku: string): Product | undefined {
    for (const product of this.products.values()) {
      if (product.sku === sku) return product;
    }
    return undefined;
  }

  create(input: CreateProductInput): Product {
    if (input === null || typeof input !== "object") {
      fail("VALIDATION", "input must be an object");
    }

    const name = parseName(input.name);
    const sku = parseSku(input.sku);
    const price = parsePrice(input.price);
    const stock = input.stock === undefined ? 0 : parseStock(input.stock);
    const category = parseCategory(input.category);

    if (this.findBySku(sku)) {
      fail("DUPLICATE_SKU", `sku ${sku} already exists`);
    }

    const now = new Date();
    const product: Product = {
      id: randomUUID(),
      name,
      sku,
      price,
      stock,
      category,
      active: true,
      createdAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime()),
    };
    this.products.set(product.id, product);
    return copyOf(product);
  }

  getById(id: string): Product | null {
    const product = typeof id === "string" ? this.products.get(id) : undefined;
    return product ? copyOf(product) : null;
  }

  getBySku(sku: string): Product | null {
    if (typeof sku !== "string") return null;
    const normalized = sku.trim().toUpperCase();
    if (normalized === "") return null;
    const product = this.findBySku(normalized);
    return product ? copyOf(product) : null;
  }

  list(query: ListProductsQuery = {}): Product[] {
    const filters = query ?? {};
    const minPrice = parsePriceBound(filters.minPrice, "minPrice");
    const maxPrice = parsePriceBound(filters.maxPrice, "maxPrice");
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      fail("VALIDATION", "minPrice cannot be greater than maxPrice");
    }

    const search =
      typeof filters.search === "string" ? filters.search.trim().toLowerCase() : "";
    const category =
      typeof filters.category === "string" ? filters.category.trim().toLowerCase() : "";

    return [...this.products.values()]
      .filter((product) => {
        if (search !== "" && !product.name.toLowerCase().includes(search)) return false;
        if (category !== "" && (product.category ?? "").toLowerCase() !== category) return false;
        if (filters.active !== undefined && product.active !== filters.active) return false;
        if (minPrice !== undefined && product.price < minPrice) return false;
        if (maxPrice !== undefined && product.price > maxPrice) return false;
        return true;
      })
      .sort((a, b) => {
        const byName = a.name.localeCompare(b.name, "es", { sensitivity: "base" });
        if (byName !== 0) return byName;
        return a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0;
      })
      .map(copyOf);
  }

  update(id: string, patch: UpdateProductInput): Product {
    const current = typeof id === "string" ? this.products.get(id) : undefined;
    if (!current) fail("NOT_FOUND", `product ${String(id)} not found`);
    if (patch === null || typeof patch !== "object") {
      fail("VALIDATION", "patch must be an object");
    }

    // Se valida y se calcula todo antes de tocar lo guardado.
    const next: Product = copyOf(current);
    let changed = false;

    if (patch.name !== undefined) {
      next.name = parseName(patch.name);
      changed = true;
    }
    if (patch.sku !== undefined) {
      const sku = parseSku(patch.sku);
      const owner = this.findBySku(sku);
      if (owner && owner.id !== current.id) {
        fail("DUPLICATE_SKU", `sku ${sku} already exists`);
      }
      next.sku = sku;
      changed = true;
    }
    if (patch.price !== undefined) {
      next.price = parsePrice(patch.price);
      changed = true;
    }
    if (patch.stock !== undefined) {
      next.stock = parseStock(patch.stock);
      changed = true;
    }
    if (patch.category !== undefined) {
      next.category = parseCategory(patch.category);
      changed = true;
    }
    if (patch.active !== undefined) {
      next.active = parseActive(patch.active);
      changed = true;
    }

    if (!changed) return copyOf(current);

    next.updatedAt = new Date();
    this.products.set(current.id, next);
    return copyOf(next);
  }

  remove(id: string): boolean {
    return typeof id === "string" ? this.products.delete(id) : false;
  }

  adjustStock(id: string, delta: number): Product {
    const current = typeof id === "string" ? this.products.get(id) : undefined;
    if (!current) fail("NOT_FOUND", `product ${String(id)} not found`);
    if (typeof delta !== "number" || !Number.isInteger(delta) || delta === 0) {
      fail("VALIDATION", "delta must be a non-zero integer");
    }
    const stock = current.stock + delta;
    if (stock < 0) fail("INSUFFICIENT_STOCK", "stock cannot go below zero");

    const next: Product = { ...copyOf(current), stock, updatedAt: new Date() };
    this.products.set(current.id, next);
    return copyOf(next);
  }
}
