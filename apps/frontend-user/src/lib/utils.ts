/**
 * 通用工具 —— shadcn 约定的 cn()：合并 className（clsx）并去重 Tailwind 冲突类（tailwind-merge）。
 * components.json 中 utils 别名指向 @/lib/utils，全站组件经此导入 cn。
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}