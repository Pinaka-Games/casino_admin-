"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Save } from "lucide-react";
import toast from "react-hot-toast";
import { redeemApi, SpinConfig } from "@/api/redeem/redeem.api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type W9FieldKey =
  | "legalName"
  | "businessName"
  | "taxClassification"
  | "taxIdType"
  | "taxId"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "state"
  | "zipCode"
  | "signature";

type W9FieldConfig = {
  label: string;
  placeholder?: string;
  required: boolean;
};

type W9Option = {
  value: string;
  label: string;
};

type W9FormConfig = {
  title: string;
  description: string;
  certificationLabel: string;
  fields: Record<W9FieldKey, W9FieldConfig>;
  taxClassificationOptions: W9Option[];
  taxIdTypeOptions: W9Option[];
};

const fieldOrder: W9FieldKey[] = [
  "legalName",
  "businessName",
  "taxClassification",
  "taxIdType",
  "taxId",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zipCode",
  "signature",
];

const defaultW9FormConfig: W9FormConfig = {
  title: "W-9 Tax Form",
  description:
    "Your withdrawals exceeded the configured yearly threshold. Please submit your tax information.",
  certificationLabel:
    "I certify that the information provided is correct and that I am the taxpayer identified above.",
  fields: {
    legalName: { label: "Full Name", placeholder: "John Doe", required: true },
    businessName: {
      label: "Business Name / Disregarded Entity",
      placeholder: "My Business LLC",
      required: false,
    },
    taxClassification: { label: "Federal Tax Classification", placeholder: "", required: true },
    taxIdType: { label: "Taxpayer Identification Type", placeholder: "", required: true },
    taxId: {
      label: "Taxpayer Identification Number (TIN)",
      placeholder: "123-45-6789",
      required: true,
    },
    addressLine1: { label: "Street Address", placeholder: "123 Main Street", required: true },
    addressLine2: {
      label: "Address Line 2",
      placeholder: "Apartment, suite, unit, etc.",
      required: false,
    },
    city: { label: "City", placeholder: "Austin", required: true },
    state: { label: "State", placeholder: "TX", required: true },
    zipCode: { label: "ZIP Code", placeholder: "78701", required: true },
    signature: { label: "Signature", placeholder: "Type full name", required: true },
  },
  taxClassificationOptions: [
    { value: "INDIVIDUAL", label: "Individual / Sole Proprietor" },
    { value: "C_CORPORATION", label: "C Corporation" },
    { value: "S_CORPORATION", label: "S Corporation" },
    { value: "PARTNERSHIP", label: "Partnership" },
    { value: "TRUST_ESTATE", label: "Trust / Estate" },
    { value: "LLC", label: "Limited Liability Company (LLC)" },
    { value: "OTHER", label: "Other" },
  ],
  taxIdTypeOptions: [
    { value: "SSN", label: "SSN" },
    { value: "EIN", label: "EIN" },
  ],
};

const fieldTitles: Record<W9FieldKey, string> = {
  legalName: "Legal Name",
  businessName: "Business Name",
  taxClassification: "Tax Classification",
  taxIdType: "Tax ID Type",
  taxId: "Tax ID Number",
  addressLine1: "Address Line 1",
  addressLine2: "Address Line 2",
  city: "City",
  state: "State",
  zipCode: "ZIP Code",
  signature: "Signature",
};

export default function SpinConfigPage() {
  const [config, setConfig] = useState<SpinConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [w9ThresholdAmount, setW9ThresholdAmount] = useState("");
  const [w9FormConfig, setW9FormConfig] = useState<W9FormConfig>(defaultW9FormConfig);

  const normalizeW9FormConfig = (incoming?: Record<string, any> | null): W9FormConfig => {
    const raw = incoming ?? {};
    const fields = Object.fromEntries(
      fieldOrder.map((key) => [
        key,
        {
          label: raw.fields?.[key]?.label ?? defaultW9FormConfig.fields[key].label,
          placeholder:
            raw.fields?.[key]?.placeholder ?? defaultW9FormConfig.fields[key].placeholder ?? "",
          required:
            typeof raw.fields?.[key]?.required === "boolean"
              ? raw.fields[key].required
              : defaultW9FormConfig.fields[key].required,
        },
      ]),
    ) as Record<W9FieldKey, W9FieldConfig>;

    return {
      title: raw.title ?? defaultW9FormConfig.title,
      description: raw.description ?? defaultW9FormConfig.description,
      certificationLabel:
        raw.certificationLabel ?? defaultW9FormConfig.certificationLabel,
      fields,
      taxClassificationOptions:
        raw.taxClassificationOptions?.length
          ? raw.taxClassificationOptions.map((option: W9Option, index: number) => ({
              value:
                option?.value ?? defaultW9FormConfig.taxClassificationOptions[index]?.value ?? "",
              label:
                option?.label ?? defaultW9FormConfig.taxClassificationOptions[index]?.label ?? "",
            }))
          : defaultW9FormConfig.taxClassificationOptions,
      taxIdTypeOptions:
        raw.taxIdTypeOptions?.length
          ? raw.taxIdTypeOptions.map((option: W9Option, index: number) => ({
              value: option?.value ?? defaultW9FormConfig.taxIdTypeOptions[index]?.value ?? "",
              label: option?.label ?? defaultW9FormConfig.taxIdTypeOptions[index]?.label ?? "",
            }))
          : defaultW9FormConfig.taxIdTypeOptions,
    };
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await redeemApi.getSpinConfig();
      const cfg = res.data;
      setConfig(cfg);
      setW9ThresholdAmount(String(cfg.w9ThresholdAmount));
      setW9FormConfig(normalizeW9FormConfig(cfg.w9FormConfig));
    } catch {
      toast.error("Failed to load spin config");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateField = (
    field: W9FieldKey,
    property: keyof W9FieldConfig,
    value: string | boolean,
  ) => {
    setW9FormConfig((prev) => ({
      ...prev,
      fields: {
        ...prev.fields,
        [field]: {
          ...prev.fields[field],
          [property]: value,
        },
      },
    }));
  };

  const updateOption = (
    section: "taxClassificationOptions" | "taxIdTypeOptions",
    index: number,
    label: string,
  ) => {
    setW9FormConfig((prev) => ({
      ...prev,
      [section]: prev[section].map((option, optionIndex) =>
        optionIndex === index ? { ...option, label } : option,
      ),
    }));
  };

  const handleSave = async () => {
    const threshold = parseInt(w9ThresholdAmount);
    if (!threshold || threshold < 1) {
      toast.error("W-9 threshold amount must be at least 1");
      return;
    }

    setSaving(true);
    try {
      // Spin-wheel values (max spins, payout cap, segments) are no longer edited
      // here — preserve the existing config so the spin feature keeps working.
      const res = await redeemApi.updateSpinConfig({
        maxSpinsPerDay: config?.maxSpinsPerDay,
        maxRedeemAmount: config?.maxRedeemAmount,
        segmentPercentages: config
          ? config.segmentPercentages
              .split(",")
              .map((s) => Number(s.trim()))
              .filter((n) => Number.isFinite(n))
          : undefined,
        w9ThresholdAmount: threshold,
        w9FormConfig,
      });
      setConfig(res.data);
      setW9FormConfig(normalizeW9FormConfig(res.data.w9FormConfig));
      toast.success("W-9 config saved");
    } catch {
      toast.error("Failed to save W-9 config");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">W-9 Form Config</h1>
        </div>
        {/* Entered from Tax Forms — this page is no longer in the sidebar, so it
            has to offer the way back. */}
        <Link href="/wallet/tax-forms">
          <Button
            variant="outline"
            className="h-9 border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tax Forms
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-6 rounded-xl border border-gray-800 bg-[#191D24] p-6">
          <div className="space-y-2">
            <Label className="text-white">W-9 Threshold Amount</Label>
            <p className="text-xs text-gray-500">
              Users can redeem up to this yearly amount without W-9. After crossing it,
              they must submit a W-9 and get admin verification.
            </p>
            <Input
              type="number"
              min={1}
              value={w9ThresholdAmount}
              onChange={(e) => setW9ThresholdAmount(e.target.value)}
              className="w-48 bg-[#0E1117] text-white border-gray-700"
            />
          </div>

          <div className="space-y-4 rounded-xl border border-gray-800 bg-[#141821] p-5">
            <div>
              <h2 className="text-lg font-semibold text-white">W-9 Form Settings</h2>
              <p className="mt-1 text-xs text-gray-500">
                Edit the user-side W-9 form with normal input fields and required checkboxes.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-white">Form Title</Label>
                <Input
                  value={w9FormConfig.title}
                  onChange={(e) =>
                    setW9FormConfig((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="bg-[#0E1117] text-white border-gray-700"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-white">Form Description</Label>
                <Input
                  value={w9FormConfig.description}
                  onChange={(e) =>
                    setW9FormConfig((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="bg-[#0E1117] text-white border-gray-700"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-white">Certification Text</Label>
                <Input
                  value={w9FormConfig.certificationLabel}
                  onChange={(e) =>
                    setW9FormConfig((prev) => ({
                      ...prev,
                      certificationLabel: e.target.value,
                    }))
                  }
                  className="bg-[#0E1117] text-white border-gray-700"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
                Form Fields
              </h3>

              {fieldOrder.map((fieldKey) => (
                <div
                  key={fieldKey}
                  className="grid grid-cols-1 gap-4 rounded-lg border border-gray-800 bg-[#0E1117] p-4 md:grid-cols-[1.1fr_1.2fr_auto]"
                >
                  <div className="space-y-2">
                    <Label className="text-white">{fieldTitles[fieldKey]} Label</Label>
                    <Input
                      value={w9FormConfig.fields[fieldKey].label}
                      onChange={(e) => updateField(fieldKey, "label", e.target.value)}
                      className="bg-[#141821] text-white border-gray-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Placeholder</Label>
                    <Input
                      value={w9FormConfig.fields[fieldKey].placeholder || ""}
                      onChange={(e) => updateField(fieldKey, "placeholder", e.target.value)}
                      className="bg-[#141821] text-white border-gray-700"
                      disabled={fieldKey === "taxClassification" || fieldKey === "taxIdType"}
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-3 rounded-md border border-gray-700 bg-[#141821] px-4 py-3 text-sm text-gray-200">
                      <Checkbox
                        checked={w9FormConfig.fields[fieldKey].required}
                        onCheckedChange={(checked) =>
                          updateField(fieldKey, "required", Boolean(checked))
                        }
                      />
                      <span>Required</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-gray-800 bg-[#0E1117] p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
                  Tax Classification Options
                </h3>
                {w9FormConfig.taxClassificationOptions.map((option, index) => (
                  <div key={option.value} className="space-y-2">
                    <Label className="text-white">{option.value}</Label>
                    <Input
                      value={option.label}
                      onChange={(e) =>
                        updateOption("taxClassificationOptions", index, e.target.value)
                      }
                      className="bg-[#141821] text-white border-gray-700"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-lg border border-gray-800 bg-[#0E1117] p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
                  Tax ID Type Options
                </h3>
                {w9FormConfig.taxIdTypeOptions.map((option, index) => (
                  <div key={option.value} className="space-y-2">
                    <Label className="text-white">{option.value}</Label>
                    <Input
                      value={option.label}
                      onChange={(e) =>
                        updateOption("taxIdTypeOptions", index, e.target.value)
                      }
                      className="bg-[#141821] text-white border-gray-700"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {config?.updatedAt && (
            <p className="text-xs text-gray-600">
              Last updated: {new Date(config.updatedAt).toLocaleString()}
            </p>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
