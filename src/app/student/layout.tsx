import type { Metadata } from "next";

/**
 * The student area. Exists only to hang the title template — the visual shell
 * (sidebar + top bar) is TeacherShell, rendered by each screen, because it
 * needs the client-side session to know which nav to draw.
 */
export const metadata: Metadata = {
  title: {
    template: "%s · Gyaanverse",
    default: "Gyaanverse",
  },
};

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
