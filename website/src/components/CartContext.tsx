"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { type Locale } from "@/lib/i18n";
import { MAX_ORDER_QUANTITY, clampQuantity, type ShopCurrency } from "@/lib/content/shop";

export interface CartItem {
  id: string;
  name: string;
  price: number; // jednostki minimalne waluty `currency` (69900 = 699 zł, 16900 = 169 €)
  quantity: number;
  /** Waluta ceny — PLN (PL) albo EUR (reszta swiata); brak = stary koszyk = PLN. */
  currency?: ShopCurrency;
  /** Jezyk landingu, z ktorego dodano produkt — /koszyk i powrot do checkoutu. */
  lang?: Locale;
  image?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, qty?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = "km_cart";
// Checkout (BuyNow -> Stripe/P24) obsluguje do MAX_ORDER_QUANTITY sztuk na
// zamowienie (ilosc + personalizacja kazdej sztuki idzie do API platnosci).
export const CART_MAX_QTY = MAX_ORDER_QUANTITY;
const MAX_QTY = CART_MAX_QTY;

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Zapisane koszyki przycinamy do limitu (1..MAX_QTY).
    return (parsed as CartItem[])
      .filter((i) => i && typeof i.id === "string" && typeof i.price === "number")
      .map((i) => ({ ...i, quantity: clampQuantity(i.quantity, MAX_QTY) }));
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setItems(loadCart());
    setHydrated(true);
  }, []);

  // Persist on change (skip first render before hydration)
  useEffect(() => {
    if (hydrated) saveCart(items);
  }, [items, hydrated]);

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity">, qty = 1) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.id === item.id);
        if (existing) {
          // Ponowne dodanie aktualizuje cene/walute/jezyk (np. dodano z /en
          // w EUR, potem z / w PLN), ilosc zostaje w limicie.
          return prev.map((i) =>
            i.id === item.id
              ? { ...i, ...item, quantity: clampQuantity(i.quantity + qty, MAX_QTY) }
              : i
          );
        }
        return [...prev, { ...item, quantity: clampQuantity(qty, MAX_QTY) }];
      });
      setIsDrawerOpen(true);
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, quantity: clampQuantity(quantity, MAX_QTY) } : i
      )
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
