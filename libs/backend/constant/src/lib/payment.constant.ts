export interface ProductInterface {
  id: string;
  title: string;
  description: string;
  value: number;
  cost: number;
  oldCost: number;
  active: boolean;
  isTrial: boolean;
  isPreferred: boolean;
}

export class EnabledProductInterface {
  [product: string]: ProductInterface;
}

export const getAllProducts = (disabled?: boolean): EnabledProductInterface => {
  const products = { ...PRODUCTS };
  Object.keys(products).forEach((product) => {
    if (disabled !== true && !products[product].active) {
      delete products[product];
    }
  });

  return products;
};

export const getProductsNames = (disabled?: boolean): string[] => {
  return Object.keys(getAllProducts(disabled));
};

export const PRODUCTS: {
  [product: string]: ProductInterface;
} = {
  FREE_TRIAL_30_DAYS: {
    id: 'FREE_TRIAL_30_DAYS',
    title: 'Free trial 30 days',
    description: 'Free trial 30 days subscription',
    value: 30,
    cost: 0,
    oldCost: 0,
    active: true,
    isTrial: true,
    isPreferred: false,
  },
  SUBSCRIPTION_30_DAYS: {
    id: 'SUBSCRIPTION_30_DAYS',
    title: '30 days',
    description: '30 days subscription',
    value: 30,
    cost: 49.99,
    oldCost: 99.99,
    active: false,
    isTrial: false,
    isPreferred: false,
  },
  SUBSCRIPTION_180_DAYS: {
    id: 'SUBSCRIPTION_180_DAYS',
    title: '180 days',
    description: '180 days subscription',
    value: 180,
    cost: 199.99,
    oldCost: 299.99,
    active: true,
    isTrial: false,
    isPreferred: false,
  },
  SUBSCRIPTION_360_DAYS: {
    id: 'SUBSCRIPTION_360_DAYS',
    title: '360 days',
    description: '360 days subscription',
    value: 360,
    cost: 359.99,
    oldCost: 599.99,
    active: true,
    isTrial: false,
    isPreferred: true,
  },
  SUBSCRIPTION_720_DAYS: {
    id: 'SUBSCRIPTION_720_DAYS',
    title: '720 days',
    description: '720 days subscription',
    value: 720,
    cost: 599.99,
    oldCost: 1199.99,
    active: true,
    isTrial: false,
    isPreferred: false,
  },
};

export const DEFAULT_PRODUCT: ProductInterface = PRODUCTS.SUBSCRIPTION_180_DAYS;

export const REFERRAL_REWARD = {
  LEVEL_1: 20,
  LEVEL_2: 10,
};
