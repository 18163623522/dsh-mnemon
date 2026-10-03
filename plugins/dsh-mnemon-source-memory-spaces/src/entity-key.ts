/**
 * One spelling-insensitive key per entity, shared by the Host's entity index
 * and the Client's graph so both count the same memories for an entity.
 */
export function normalizeEntityKey(entity: string): string {
  return entity.normalize('NFKC').trim().toLocaleLowerCase()
}
