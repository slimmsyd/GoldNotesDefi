import { ShippingMethod } from "@/types/shipping-types";

export const SHIPPING_METHODS: ShippingMethod[] = [
  {
    id: "first-class",
    name: "First Class",
    cost: 8.95,
    minOrderValue: 0,    // Fixed: was 100, now covers all orders under $300
    maxOrderValue: 299,
    insurance: 500,
    requiresSignature: false,
    isInternational: false,
  },
  {
    id: "priority-mail",
    name: "Priority Mail",
    cost: 12.95,
    minOrderValue: 300,
    maxOrderValue: 499,
    insurance: 1000,
    requiresSignature: false,
    isInternational: false,
  },
  {
    id: "priority-signature",
    name: "Priority + Signature",
    cost: 14.95,
    minOrderValue: 500,
    maxOrderValue: 999,
    insurance: 1000,
    requiresSignature: true,
    isInternational: false,
  },
  {
    id: "registered-mail",
    name: "Registered Mail",
    cost: 24.95,
    minOrderValue: 1000,
    maxOrderValue: null,
    insurance: 25000,
    requiresSignature: true,
    isInternational: false,
  },
  {
    id: "priority-international",
    name: "Priority International",
    cost: 39.95,
    minOrderValue: 0,
    maxOrderValue: null,
    insurance: 200,
    requiresSignature: true,
    isInternational: true,
  },
];

/**
 * Calculate the appropriate shipping method based on order subtotal
 * @param subtotal - Order subtotal in dollars
 * @param isInternational - Whether the order is international
 * @returns The appropriate shipping method
 */
export function calculateShippingMethod(
  subtotal: number,
  isInternational: boolean = false
): ShippingMethod {
  // International orders always use Priority International
  if (isInternational) {
    return SHIPPING_METHODS.find((m) => m.isInternational)!;
  }

  // Find the appropriate domestic shipping method based on order value
  const method = SHIPPING_METHODS.find(
    (m) =>
      !m.isInternational &&
      subtotal >= m.minOrderValue &&
      (m.maxOrderValue === null || subtotal <= m.maxOrderValue)
  );

  // Fallback to registered mail for high-value orders
  if (!method) {
    return SHIPPING_METHODS.find((m) => m.id === "registered-mail")!;
  }

  return method;
}

/**
 * Get all available shipping methods for a given order value
 * Users can only select methods at or above their required tier
 * @param subtotal - Order subtotal in dollars
 * @param isInternational - Whether the order is international
 * @returns Array of available shipping methods
 */
export function getAvailableShippingMethods(
  subtotal: number,
  isInternational: boolean = false
): ShippingMethod[] {
  if (isInternational) {
    return SHIPPING_METHODS.filter((m) => m.isInternational);
  }

  // Find the minimum required method based on order value
  const requiredMethod = calculateShippingMethod(subtotal, false);

  // Return all methods at or above the required tier
  return SHIPPING_METHODS.filter(
    (m) =>
      !m.isInternational && m.minOrderValue >= requiredMethod.minOrderValue
  );
}
