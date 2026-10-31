"use client";

import React from "react";
import { X } from "lucide-react";
import CopyButton from "@/components/CopyButton";
import type { SeonRiskDecisionRow } from "@/api/compliance";

interface SeonRiskDetailsModalProps {
  open: boolean;
  data: SeonRiskDecisionRow | null;
  onClose: () => void;
}

export default function SeonRiskDetailsModal({
  open,
  data,
  onClose,
}: SeonRiskDetailsModalProps) {
  if (!open || !data) return null;

  type DetailField = {
    label: string;
    value: unknown;
    mono?: boolean;
    isDate?: boolean;
  };
  type DetailCardOptions = {
    showWhenEmpty?: boolean;
  };

  const formatDate = (date: string) => {
    // Backend stores UTC. If the value has no timezone/offset, treat it as UTC so
    // the time is correct in the viewer's local zone (not off by the local offset).
    const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(date);
    const iso = hasZone ? date : `${date.replace(" ", "T")}Z`;
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const decisionColor: Record<string, string> = {
    ALLOW: "text-green-400",
    BLOCK: "text-red-400",
    STEP_UP: "text-yellow-400",
  };
  // Display-only: show STEP_UP as REVIEW to match SEON's ALLOW/REVIEW/BLOCK states.
  const decisionLabel = (v: string) => (v === "STEP_UP" ? "REVIEW" : v);

  const firstDefined = (...values: unknown[]) =>
    values.find((value) => value !== undefined && value !== null);
  const safeString = (value?: string | null) => value || "-";
  const parseJsonLike = (value: unknown): unknown => {
    if (typeof value !== "string") return value;

    const trimmed = value.trim();
    if (!trimmed) return value;

    const candidates = [trimmed];
    const firstJsonIndex = trimmed.search(/[\[{]/);
    if (firstJsonIndex > 0) {
      candidates.push(trimmed.slice(firstJsonIndex));
    }

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate);
      } catch {
        continue;
      }
    }

    return value;
  };
  const asRecord = (value: unknown): Record<string, unknown> | null => {
    const parsed = parseJsonLike(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  };
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "-";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      if (value.length === 0) return "-";
      const allPrimitive = value.every(
        (item) =>
          typeof item === "string" || typeof item === "number" || typeof item === "boolean",
      );
      return allPrimitive ? value.map((item) => formatValue(item)).join(", ") : JSON.stringify(value);
    }
    return JSON.stringify(value);
  };
  const hasMeaningfulValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  };
  const formatMaybeDate = (value: unknown) => {
    if (typeof value !== "string" || !value) return "-";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : formatDate(value);
  };
  const booleanClass = (value: unknown) => {
    if (typeof value !== "boolean") return "text-gray-300";
    return value ? "text-green-400" : "text-red-400";
  };
  const geofence = asRecord(data.geofenceRaw);
  const geofenceLocation = asRecord(geofence?.location);
  const geofenceIntegrity = asRecord(geofence?.integrity);
  const geofenceUserState = asRecord(geofence?.user_state);
  const hasFailureMode = hasMeaningfulValue(data.failureMode);
  const hasFailureDetail = hasMeaningfulValue(data.failureDetail);
  const showGeofenceUserState =
    Boolean(geofenceUserState) &&
    (geofenceUserState?.allow === false ||
      hasMeaningfulValue(geofenceUserState?.suspend_start) ||
      hasMeaningfulValue(geofenceUserState?.suspend_end) ||
      hasMeaningfulValue(geofenceUserState?.suspended_reason));
  const fraud = asRecord(data.fraudRaw);
  const fraudData =
    asRecord(firstDefined(fraud?.data, fraud?.result, data.fraudRaw)) ?? fraud;
  const appliedRules = Array.isArray(fraudData?.applied_rules)
    ? fraudData.applied_rules
    : [];
  const ipDetails = asRecord(fraudData?.ip_details);
  const emailDetails = asRecord(fraudData?.email_details);
  const emailDomainDetails = asRecord(emailDetails?.domain_details);
  const emailBreachDetails = asRecord(emailDetails?.breach_details);
  const emailAccountDetails = asRecord(emailDetails?.account_details);
  const deviceDetails = asRecord(firstDefined(fraudData?.device_details, fraudData));
  const phoneDetails = asRecord(fraudData?.phone_details);
  const deviceLocation = asRecord(deviceDetails?.device_location);
  const onlineProfilesCount = emailAccountDetails
    ? Object.values(emailAccountDetails).reduce<number>((count, entry) => {
        const profile = asRecord(entry);
        return profile?.registered === true ? count + 1 : count;
      }, 0)
    : undefined;

  // Our own decision metadata (amount, identity, event) — stored on every row.
  const meta = asRecord(data.metadata);
  const metaTx = asRecord(meta?.transaction);
  const metaIdentity = asRecord(meta?.identity);
  const metaContext = asRecord(meta?.context);
  const contextFields: DetailField[] = [
    { label: "Amount", value: metaTx?.amount },
    { label: "Currency", value: metaTx?.currency },
    {
      label: "Event",
      value: firstDefined(metaContext?.event, meta?.flow, data.actionType),
    },
    { label: "User ID", value: metaIdentity?.userId, mono: true },
    { label: "Email", value: metaIdentity?.email },
    { label: "Phone", value: metaIdentity?.phone },
    { label: "Step-up Cleared", value: meta?.stepUpCleared },
  ];

  const getVisibleFields = (fields: DetailField[]) =>
    fields.filter((field) => hasMeaningfulValue(field.value));

  const renderDetailCard = (
    title: string,
    fields: DetailField[],
    options?: DetailCardOptions,
  ) => {
    const visibleFields = getVisibleFields(fields);
    const displayFields = visibleFields.length > 0 ? visibleFields : options?.showWhenEmpty ? fields : [];
    if (displayFields.length === 0) return null;

    return (
      <div className="bg-[#15181E] rounded py-3 px-3 sm:px-6 space-y-2">
        <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
          {title}
        </h4>
        {displayFields.map((field) => (
          <div key={field.label} className="flex justify-between gap-3">
            <span className="text-gray-400 text-xs">{field.label}</span>
            <span
              className={`text-xs text-right break-all max-w-[70%] ${
                field.mono ? "font-mono" : ""
              } ${typeof field.value === "boolean" ? booleanClass(field.value) : "text-white"}`}
            >
              {field.isDate ? formatMaybeDate(field.value) : formatValue(field.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#191D24] shadow-xl w-full h-full max-h-none overflow-y-auto scrollbar-hide sm:h-auto sm:rounded-lg sm:max-w-4xl sm:mx-4 sm:max-h-[90vh]">
        <div className="flex items-center justify-between p-3 sm:p-6 border-b border-gray-700 sticky top-0 bg-[#191D24] z-10">
          <h2 className="text-xl font-semibold text-white">SEON Risk Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-3 space-y-3 sm:p-6 sm:space-y-6">
          <div className="bg-[#242B35] rounded-lg p-3 sm:p-4">
            <h3 className="text-sm font-semibold text-purple-400 mb-4">
              Decision Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Decision ID:</span>
                <span className="flex items-center gap-2 text-white text-sm font-mono break-all text-right max-w-[70%]">
                  {data.id}
                  <CopyButton value={data.id} size={14} />
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Action Type:</span>
                <span className="text-white text-sm text-right max-w-[70%]">
                  {safeString(data.actionType)}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Decision:</span>
                <span
                  className={`text-sm font-semibold ${
                    decisionColor[data.decision] || "text-gray-400"
                  }`}
                >
                  {decisionLabel(data.decision)}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Reason:</span>
                <span className="text-white text-sm text-right max-w-[70%]">
                  {safeString(data.reason)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#242B35] rounded-lg p-3 sm:p-4">
            <h3 className="text-sm font-semibold text-purple-400 mb-4">
              Risk Signals
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">User Identifier:</span>
                <span className="flex items-center gap-2 text-white text-sm break-all text-right max-w-[70%]">
                  {safeString(data.userIdentifier)}
                  <CopyButton value={data.userIdentifier ?? ""} size={14} />
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Client IP:</span>
                <span className="flex items-center gap-2 text-white text-sm text-right max-w-[70%]">
                  {safeString(data.clientIp)}
                  <CopyButton value={data.clientIp ?? ""} size={14} />
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Country:</span>
                <span className="text-white text-sm text-right max-w-[70%]">
                  {safeString(data.countryCode)}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Score:</span>
                <span className="text-white text-sm text-right max-w-[70%]">
                  {typeof data.score === "number" ? data.score : "-"}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">VPN / Proxy:</span>
                <span
                  className={`text-sm font-semibold ${
                    data.isVpnProxy ? "text-red-400" : "text-green-400"
                  }`}
                >
                  {typeof data.isVpnProxy === "boolean"
                    ? data.isVpnProxy
                      ? "Detected"
                      : "Not Detected"
                    : "-"}
                </span>
              </div>
              {hasFailureMode && (
                <div className="flex justify-between items-start">
                  <span className="text-gray-400 text-sm">Failure Mode:</span>
                  <span className="text-white text-sm text-right max-w-[70%]">
                    {safeString(data.failureMode)}
                  </span>
                </div>
              )}
              {hasFailureDetail && (
                <div className="flex justify-between items-start">
                  <span className="text-gray-400 text-sm">Failure Detail:</span>
                  <span className="text-white text-sm text-right max-w-[70%] break-all">
                    {safeString(data.failureDetail)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#242B35] rounded-lg p-3 sm:p-4">
            <h3 className="text-sm font-semibold text-purple-400 mb-4">Timestamp</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-gray-400 text-sm">Date:</span>
                <span className="text-white text-sm text-right">
                  {formatDate(data.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {getVisibleFields(contextFields).length > 0 && (
            <div className="bg-[#242B35] rounded-lg p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-purple-400 mb-4">
                Transaction &amp; Context
              </h3>
              {renderDetailCard("Details", contextFields)}
            </div>
          )}

          {geofence && (
            <div className="bg-[#242B35] rounded-lg p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-purple-400 mb-4">
                Geofence Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-[#15181E] rounded py-3 px-6 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                    Summary
                  </h4>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Allow</span>
                    <span className={`text-xs font-semibold ${booleanClass(geofence.allow)}`}>
                      {formatValue(geofence.allow)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Expire</span>
                    <span className="text-white text-xs text-right">
                      {formatMaybeDate(geofence.expire)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Request ID</span>
                    <span className="text-white text-xs text-right break-all font-mono max-w-[70%]">
                      {formatValue(geofence.request_id)}
                    </span>
                  </div>
                </div>

                <div className="bg-[#15181E] rounded py-3 px-6 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                    Location
                  </h4>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Allow</span>
                    <span className={`text-xs font-semibold ${booleanClass(geofenceLocation?.allow)}`}>
                      {formatValue(geofenceLocation?.allow)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Country</span>
                    <span className="text-white text-xs text-right">
                      {formatValue(geofenceLocation?.country)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Region</span>
                    <span className="text-white text-xs text-right">
                      {formatValue(geofenceLocation?.region)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Coordinates</span>
                    <span className="text-white text-xs text-right">
                      {geofenceLocation?.latitude !== undefined &&
                      geofenceLocation?.longitude !== undefined
                        ? `${formatValue(geofenceLocation.latitude)}, ${formatValue(geofenceLocation.longitude)}`
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Accuracy</span>
                    <span className="text-white text-xs text-right">
                      {formatValue(geofenceLocation?.accuracy)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Created At</span>
                    <span className="text-white text-xs text-right">
                      {formatMaybeDate(geofenceLocation?.created_at)}
                    </span>
                  </div>
                </div>

                <div className="bg-[#15181E] rounded py-3 px-6 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                    Integrity
                  </h4>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Allow</span>
                    <span className={`text-xs font-semibold ${booleanClass(geofenceIntegrity?.allow)}`}>
                      {formatValue(geofenceIntegrity?.allow)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">VPN</span>
                    <span className={`text-xs font-semibold ${booleanClass(geofenceIntegrity?.vpn)}`}>
                      {formatValue(geofenceIntegrity?.vpn)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Proxy</span>
                    <span className={`text-xs font-semibold ${booleanClass(geofenceIntegrity?.proxy)}`}>
                      {formatValue(geofenceIntegrity?.proxy)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Compromised</span>
                    <span
                      className={`text-xs font-semibold ${booleanClass(geofenceIntegrity?.compromised)}`}
                    >
                      {formatValue(geofenceIntegrity?.compromised)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">IP Mismatch</span>
                    <span className={`text-xs font-semibold ${booleanClass(geofenceIntegrity?.ip_mismatch)}`}>
                      {formatValue(geofenceIntegrity?.ip_mismatch)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Remote Access</span>
                    <span
                      className={`text-xs font-semibold ${booleanClass(geofenceIntegrity?.remote_access)}`}
                    >
                      {formatValue(geofenceIntegrity?.remote_access)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Impossible Travel</span>
                    <span
                      className={`text-xs font-semibold ${booleanClass(geofenceIntegrity?.impossible_travel)}`}
                    >
                      {formatValue(geofenceIntegrity?.impossible_travel)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-400 text-xs">Location Mismatch</span>
                    <span
                      className={`text-xs font-semibold ${booleanClass(geofenceIntegrity?.location_mismatch)}`}
                    >
                      {formatValue(geofenceIntegrity?.location_mismatch)}
                    </span>
                  </div>
                </div>

                {showGeofenceUserState && (
                  <div className="bg-[#15181E] rounded py-3 px-6 space-y-2">
                    <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                      User State
                    </h4>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-400 text-xs">Allow</span>
                      <span className={`text-xs font-semibold ${booleanClass(geofenceUserState?.allow)}`}>
                        {formatValue(geofenceUserState?.allow)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-400 text-xs">Suspend Start</span>
                      <span className="text-white text-xs text-right">
                        {formatMaybeDate(geofenceUserState?.suspend_start)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-400 text-xs">Suspend End</span>
                      <span className="text-white text-xs text-right">
                        {formatMaybeDate(geofenceUserState?.suspend_end)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-gray-400 text-xs">Suspended Reason</span>
                      <span className="text-white text-xs text-right break-all max-w-[70%]">
                        {formatValue(geofenceUserState?.suspended_reason)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {fraud && (
            <div className="bg-[#242B35] rounded-lg p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-purple-400 mb-4">
                Fraud Details
              </h3>
              <div className="space-y-3">
                <div className="bg-[#15181E] rounded py-3 px-6 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                    Summary
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-gray-800">
                    <div className="space-y-2 md:pr-4">
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-400 text-xs">Success</span>
                        <span className={`text-xs font-semibold ${booleanClass(fraud.success)}`}>
                          {formatValue(fraud.success)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-400 text-xs">Fraud Score</span>
                        <span className="text-white text-xs text-right">
                          {formatValue(fraudData?.fraud_score)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-400 text-xs">Calculation Time (ms)</span>
                        <span className="text-white text-xs text-right">
                          {formatValue(fraudData?.calculation_time)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-400 text-xs">SEON ID</span>
                        <span className="text-white text-xs text-right">
                          {formatValue(fraudData?.seon_id)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2 md:pl-4">
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-400 text-xs">State</span>
                        <span className="text-white text-xs text-right">
                          {formatValue(fraudData?.state)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-400 text-xs">Blackbox Score</span>
                        <span className="text-white text-xs text-right">
                          {formatValue(fraudData?.blackbox_score)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-400 text-xs">Version</span>
                        <span className="text-white text-xs text-right">
                          {formatValue(fraudData?.version)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-400 text-xs">Fraud Request ID</span>
                        <span className="text-white text-xs text-right break-all font-mono max-w-[70%]">
                          {formatValue(fraudData?.id)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#15181E] rounded py-3 px-6 space-y-2">
                  <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                    Applied Rules
                  </h4>
                  {appliedRules.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-gray-700 text-gray-400">
                            <th className="py-2 pr-2">Rule ID</th>
                            <th className="py-2 pr-2">Name</th>
                            <th className="py-2 pr-2">Operation</th>
                            <th className="py-2">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {appliedRules.map((rule, index) => {
                            const ruleObj = asRecord(rule);
                            return (
                              <tr key={`${formatValue(ruleObj?.id)}-${index}`} className="border-b border-gray-800/60">
                                <td className="py-2 pr-2 text-white">{formatValue(ruleObj?.id)}</td>
                                <td className="py-2 pr-2 text-white">{formatValue(ruleObj?.name)}</td>
                                <td className="py-2 pr-2 text-white">{formatValue(ruleObj?.operation)}</td>
                                <td className="py-2 text-white">{formatValue(ruleObj?.score)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No applied rules</p>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-purple-400 mb-4">
                    Data Availability
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {renderDetailCard("IP Details", [
                      { label: "IP", value: firstDefined(ipDetails?.ip, fraudData?.ip) },
                      {
                        label: "Country",
                        value: firstDefined(
                          ipDetails?.country,
                          ipDetails?.country_code,
                          ipDetails?.countryCode,
                        ),
                      },
                      { label: "City", value: ipDetails?.city },
                      {
                        label: "Region",
                        value: firstDefined(ipDetails?.state_prov, ipDetails?.region),
                      },
                      {
                        label: "ISP",
                        value: firstDefined(ipDetails?.isp_name, ipDetails?.provider_name),
                      },
                      { label: "Type", value: ipDetails?.type },
                      { label: "Timezone", value: ipDetails?.timezone_offset },
                      { label: "Risk Score", value: ipDetails?.score },
                      { label: "VPN", value: firstDefined(ipDetails?.vpn, ipDetails?.is_vpn) },
                      {
                        label: "Proxy",
                        value: firstDefined(ipDetails?.public_proxy, ipDetails?.proxy),
                      },
                      { label: "TOR", value: ipDetails?.tor },
                      { label: "Residential Proxy", value: ipDetails?.residential_proxy },
                      { label: "Spam Blacklists", value: ipDetails?.spam_number },
                    ])}

                    {renderDetailCard("Email Details", [
                      { label: "Email", value: firstDefined(emailDetails?.email, fraudData?.email) },
                      {
                        label: "Domain",
                        value: firstDefined(emailDomainDetails?.domain, emailDomainDetails?.tld),
                      },
                      { label: "Risk Score", value: emailDetails?.score },
                      { label: "Deliverable", value: emailDetails?.deliverable },
                      { label: "Registered", value: emailDomainDetails?.registered },
                      { label: "Free", value: emailDomainDetails?.free },
                      { label: "Disposable", value: emailDomainDetails?.disposable },
                      { label: "Valid MX", value: emailDomainDetails?.valid_mx },
                      { label: "DMARC Enforced", value: emailDomainDetails?.dmarc_enforced },
                      { label: "Registered To", value: emailDomainDetails?.registered_to },
                      { label: "Online Profiles", value: onlineProfilesCount },
                      { label: "HIBP Listed", value: emailBreachDetails?.haveibeenpwned_listed },
                      {
                        label: "Breaches",
                        value: emailBreachDetails?.number_of_breaches,
                      },
                      {
                        label: "First Breach",
                        value: emailBreachDetails?.first_breach,
                        isDate: true,
                      },
                    ])}

                    {renderDetailCard("Device Details", [
                      {
                        label: "Device Type",
                        value: deviceDetails?.device_type,
                      },
                      {
                        label: "OS",
                        value: deviceDetails?.os,
                      },
                      {
                        label: "Browser",
                        value:
                          deviceDetails?.browser && deviceDetails?.browser_version
                            ? `${formatValue(deviceDetails.browser)} ${formatValue(deviceDetails.browser_version)}`
                            : firstDefined(deviceDetails?.browser, deviceDetails?.browser_version),
                      },
                      {
                        label: "VPN",
                        value: deviceDetails?.vpn,
                      },
                      {
                        label: "Proxy",
                        value: deviceDetails?.proxy,
                      },
                      {
                        label: "Private Mode",
                        value: deviceDetails?.private,
                      },
                      {
                        label: "Device IP",
                        value: firstDefined(deviceDetails?.device_ip, fraudData?.ip),
                      },
                      {
                        label: "Country",
                        value: deviceDetails?.device_ip_country,
                      },
                      {
                        label: "ISP",
                        value: deviceDetails?.device_ip_isp,
                      },
                      {
                        label: "Timezone",
                        value: firstDefined(deviceDetails?.timezone, deviceDetails?.timezone_offset),
                      },
                      {
                        label: "WebRTC Count",
                        value: deviceDetails?.webrtc_count,
                      },
                      {
                        label: "Suspicious Flags",
                        value: deviceDetails?.suspicious_flags,
                      },
                      {
                        label: "Location",
                        value:
                          deviceLocation?.latitude !== undefined &&
                          deviceLocation?.longitude !== undefined
                            ? `${formatValue(deviceLocation.latitude)}, ${formatValue(deviceLocation.longitude)}`
                            : undefined,
                      },
                      {
                        label: "Location Accuracy",
                        value: deviceLocation?.accuracy,
                      },
                      {
                        label: "Source",
                        value: deviceDetails?.source,
                      },
                      {
                        label: "True Device ID",
                        value: deviceDetails?.true_device_id,
                        mono: true,
                      },
                    ])}

                    {renderDetailCard(
                      "Phone Details",
                      [
                        {
                          label: "Phone",
                          value: firstDefined(
                            phoneDetails?.number,
                            phoneDetails?.phone_number,
                            fraudData?.phone_number,
                          ),
                        },
                        { label: "Risk Score", value: phoneDetails?.score },
                        {
                          label: "Valid",
                          value: firstDefined(phoneDetails?.valid, phoneDetails?.deliverable),
                        },
                        {
                          label: "Country",
                          value: firstDefined(
                            phoneDetails?.country,
                            phoneDetails?.country_code,
                            phoneDetails?.countryCode,
                          ),
                        },
                        {
                          label: "Carrier",
                          value: firstDefined(phoneDetails?.carrier, phoneDetails?.provider_name),
                        },
                        {
                          label: "Type",
                          value: firstDefined(phoneDetails?.type, phoneDetails?.line_type),
                        },
                      ],
                      { showWhenEmpty: true },
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
