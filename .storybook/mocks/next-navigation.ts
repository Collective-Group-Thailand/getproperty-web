import { useContext } from "react";

import { StoryPathname } from "../../src/features/shared/storybook/pathname";

/** `next/navigation` for Storybook (Vite has no Next router); `ShellStory` provides the current path. */
export function usePathname(): string {
  return useContext(StoryPathname);
}

export function useRouter() {
  return {
    push: () => undefined,
    replace: () => undefined,
    refresh: () => undefined,
    back: () => undefined,
    prefetch: () => undefined,
  };
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function useParams() {
  return {};
}

export function redirect(): never {
  throw new Error("redirect() is not available in Storybook");
}

export function notFound(): never {
  throw new Error("notFound() is not available in Storybook");
}
