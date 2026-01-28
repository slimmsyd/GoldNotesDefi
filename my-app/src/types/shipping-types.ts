export type ShippingMethod = {
  id: string;
  name: string;
  cost: number;
  minOrderValue: number;
  maxOrderValue: number | null;
  insurance: number;
  requiresSignature: boolean;
  isInternational: boolean;
};

export type ShippingSelection = {
  method: ShippingMethod;
  isInternational: boolean;
};
