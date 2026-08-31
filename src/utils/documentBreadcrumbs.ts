import { findProjectByDocumentKey } from '@/server/repositories/ProjectRepository';
import { listProjectFacts } from '@/server/repositories/ProjectFactsRepository';
import { factRowsToProjectMemory } from '@/server/db/factMapper';

/** Server-side project title for breadcrumbs and metadata. */
export async function getDocumentTitle(documentKey: string): Promise<string> {
  try {
    const project = await findProjectByDocumentKey(documentKey);
    if (!project) {
      return documentKey.replace(/-/g, ' ');
    }
    if (project.name && project.name !== 'Untitled RFP') {
      return project.name;
    }
    const facts = await listProjectFacts(project.project_id);
    const memory = factRowsToProjectMemory(facts);
    const title = memory.documentTitle?.current?.value;
    if (typeof title === 'string' && title.trim()) {
      return title.trim();
    }
    return project.name || documentKey.replace(/-/g, ' ');
  } catch {
    return documentKey.replace(/-/g, ' ');
  }
}
