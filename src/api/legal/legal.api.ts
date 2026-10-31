import api from "@/api/config/axios.config";

/** One immutable revision of a document. */
export interface LegalVersion {
  id: string;
  documentId: string;
  version: number;
  /** Normally null — the wording lives in the player app, not here. */
  content: string | null;
  changeSummary: string | null;
  requiresAcceptance: boolean;
  /** Null while it is still a draft. */
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Only present on the version-history response. */
  acceptedCount?: number;
}

export interface LegalDocument {
  id: string;
  key: string;
  title: string;
  route: string | null;
  requiresAcceptance: boolean;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Newest published version — what players are held to right now. */
  liveVersion: LegalVersion | null;
  versionCount: number;
  acceptedCount: number;
}

/**
 * Publishing says "these documents changed in the release that just shipped".
 * It stamps a version for each and asks every player to re-accept.
 */
export interface PublishUpdatePayload {
  documentIds: string[];
  changeSummary?: string;
  requiresAcceptance?: boolean;
  notifyPlayers?: boolean;
}

export const getLegalDocuments = () =>
  api.get<LegalDocument[]>("/legal-documents");

export const getLegalVersions = (documentId: string) =>
  api.get<LegalVersion[]>(`/legal-documents/${documentId}/versions`);

export const updateLegalDocument = (
  documentId: string,
  data: Partial<Pick<LegalDocument, "title" | "route" | "requiresAcceptance" | "isActive" | "displayOrder">>,
) => api.patch<LegalDocument>(`/legal-documents/${documentId}`, data);

export const publishLegalUpdate = (data: PublishUpdatePayload) =>
  api.post<LegalVersion[]>("/legal-documents/publish", data);
