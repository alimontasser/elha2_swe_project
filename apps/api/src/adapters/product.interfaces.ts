/** A packaged product as an outside product database describes it. */
export interface ExternalProduct {
  nameAr?: string;
  nameEn?: string;
  brand?: string;
  /** As printed, e.g. "1 l" or "400 g". */
  quantityText?: string;
  /** English category names, e.g. ["dairies", "milks"]. */
  categories: string[];
}

export type ProductLookupResult = { status: 'found'; product: ExternalProduct } | { status: 'missing' } | { status: 'failed' };

/** IProduct (SDD §3.2.4, Adapters): barcode lookup in an open product database. */
export interface IProduct {
  lookup(barcode: string): Promise<ProductLookupResult>;
}

export const PRODUCT_SOURCE = Symbol('IProduct');
