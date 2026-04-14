import type { EntityRegistry } from '../types.js';

/**
 * SCN intermediate clause representation.
 */
export interface SCNClause {
  predicate: string;
  roles: Record<string, string>;
  modality?: string;
  discourseRelation?: string;
}

/**
 * SCN document representation.
 */
export interface SCNDocument {
  header?: {
    topic?: string;
    domain?: string;
    timeframe?: string;
  };
  entities: EntityRegistry;
  clauses: SCNClause[];
}

/**
 * Serialize an SCN clause to string format.
 *
 * Example output:
 *   RAISE a0:ECB a1:interest-rates a2:+50bp tm:Thursday mn:unexpected
 */
export function serializeClause(clause: SCNClause): string {
  const parts: string[] = [];

  // Modality prefix
  if (clause.modality) {
    parts.push(`${clause.modality}:${clause.predicate}`);
  } else {
    parts.push(clause.predicate);
  }

  // Discourse relation prefix (for nested clauses)
  let prefix = '';
  if (clause.discourseRelation) {
    prefix = `${clause.discourseRelation}: `;
  }

  // Role-value pairs in standard order
  const roleOrder = ['a0', 'a1', 'a2', 'a3', 'a4', 'tm', 'lc', 'mn', 'cs', 'cnd', 'deg', 'src'];
  for (const role of roleOrder) {
    if (clause.roles[role]) {
      parts.push(`${role}:${clause.roles[role]}`);
    }
  }

  // Any remaining roles not in standard order
  for (const [role, value] of Object.entries(clause.roles)) {
    if (!roleOrder.includes(role)) {
      parts.push(`${role}:${value}`);
    }
  }

  return prefix + parts.join(' ');
}

/**
 * Serialize an SCN document header.
 */
export function serializeHeader(header: SCNDocument['header']): string {
  if (!header) return '';
  const parts = [];
  if (header.topic) parts.push(header.topic);
  if (header.domain) parts.push(`ctx:${header.domain}`);
  if (header.timeframe) parts.push(`t:${header.timeframe}`);
  return parts.length > 0 ? `# ${parts.join(' | ')}` : '';
}

/**
 * Serialize entity definitions from a registry.
 */
export function serializeEntities(registry: EntityRegistry): string {
  const lines: string[] = [];
  for (const [, entity] of registry.entities) {
    if (entity.count < 2) continue;
    const typeStr = entity.type && entity.type !== 'other' ? `(type:${entity.type})` : '';
    lines.push(`@${entity.id}=${entity.canonical}${typeStr}`);
  }
  return lines.join('\n');
}

/**
 * Serialize a full SCN document to string.
 */
export function serializeDocument(doc: SCNDocument): string {
  const sections: string[] = [];

  // Header
  const header = serializeHeader(doc.header);
  if (header) sections.push(header);

  // Entity definitions
  const entities = serializeEntities(doc.entities);
  if (entities) sections.push(entities);

  // Clauses
  if (doc.clauses.length > 0) {
    const clauseLines = doc.clauses.map(serializeClause);
    sections.push(clauseLines.join('\n'));
  }

  return sections.join('\n\n');
}
