export interface Project {
  name: string;
  summary: string;
  href: string;
}

/** Project cards. An empty list renders 「整理中」 on the projects page. */
export const projects: Project[] = [];
