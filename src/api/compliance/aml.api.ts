import api from "../config/axios.config";

export type AmlSeverity = "LOW" | "MEDIUM" | "HIGH";
export type AmlAlertStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "FALSE_POSITIVE"
  | "CLOSED"
  | "ESCALATED";

export type AmlAlertRow = {
  id: string;
  sourceType: string;
  severity: AmlSeverity;
  status: AmlAlertStatus;
  assignedTo?: string | null;
  userIdentifier?: string | null;
  summary?: string | null;
  details?: unknown;
  checklistTemplateId?: string | null;
  caseId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AmlAlertListParams = {
  page?: number;
  limit?: number;
  status?: string;
  severity?: string;
  assignedTo?: string;
  search?: string;
};

export type AmlAlertListResponse = {
  page: number;
  limit: number;
  total: number;
  rows: AmlAlertRow[];
};

/** GET /compliance/aml/alerts */
export const listAmlAlerts = async (params: AmlAlertListParams) => {
  const res = await api.get<AmlAlertListResponse>("/compliance/aml/alerts", {
    params,
  });
  return res.data;
};

/** GET /compliance/aml/alerts/:id */
export const getAmlAlert = async (id: string) => {
  const res = await api.get<AmlAlertRow>(`/compliance/aml/alerts/${id}`);
  return res.data;
};

/** POST /compliance/aml/alerts/:id/status */
export const updateAmlAlertStatus = async (id: string, status: AmlAlertStatus) => {
  const res = await api.post<AmlAlertRow>(`/compliance/aml/alerts/${id}/status`, {
    status,
  });
  return res.data;
};

/** POST /compliance/aml/alerts/:id/assign */
export const assignAmlAlert = async (id: string, assignedTo: string) => {
  const res = await api.post<AmlAlertRow>(`/compliance/aml/alerts/${id}/assign`, {
    assignedTo,
  });
  return res.data;
};

/** POST /compliance/aml/alerts/:id/escalate — opens/links an AML case */
export const escalateAmlAlert = async (
  id: string,
  body?: { summary?: string; priority?: AmlSeverity; existingCaseId?: string },
) => {
  const res = await api.post(`/compliance/aml/alerts/${id}/escalate`, body ?? {});
  return res.data;
};
