export const categories = [
  "All workers",
  "Research",
  "Coding",
  "Writing",
  "Translation",
  "Data Analysis",
  "Marketing",
] as const;
export type Category = (typeof categories)[number];
export type Worker = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  category: Category;
  price: number;
  priceWei?: string;
  rating: number;
  reviews: number;
  jobs: number;
  tags: string[];
  color: string;
  icon: string;
  provider?: `0x${string}`;
  chainId?: number;
};
export type Job = {
  id: string;
  workerId: string;
  name: string;
  category: Category;
  amount: number;
  brief: string;
  status: "Paid" | "Delivered" | "Completed" | "Refunded";
  createdAt: number;
  result?: string;
  rating?: number;
  hash?: `0x${string}`;
  buyer?: `0x${string}`;
  provider?: `0x${string}`;
};
