export * from './types';
export { GoogleWorkspaceConnector } from './connectors/google';
export { Microsoft365Connector } from './connectors/microsoft';
export { GenericRestConnector } from './connectors/rest';

import { GoogleWorkspaceConnector } from './connectors/google';
import { Microsoft365Connector } from './connectors/microsoft';
import { GenericRestConnector } from './connectors/rest';
import type { Connector } from './types';

export const ALL_CONNECTORS: Connector[] = [
  GoogleWorkspaceConnector,
  Microsoft365Connector,
  GenericRestConnector,
];

export function getConnector(id: string): Connector | undefined {
  return ALL_CONNECTORS.find((c) => c.id === id);
}
