"use client";

import {
  cloneElement,
  forwardRef,
  isValidElement,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Check, Eye, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import BundleSalePreviewModal from "./components/BundleSalePreviewModal";
import SettingsGuideDialog from "./components/SettingsGuideDialog";
import MaintenanceWindowStatus from "./components/MaintenanceWindowStatus";
import IpAllowlistField from "./components/IpAllowlistField";
import { TimezoneSelect } from "./components/TimezoneSelect";
import { useSystemConfigStore } from "@/store/system-config-store";
import { SystemConfig } from "@/types/system-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FreeSpinAPI } from "@/api";
import type { FreeSpin } from "@/types/free-spin";
// The section/field schema lives in config so the global settings search can
// index every individual setting on this page without importing the page.
import {
  SECTION_DEFINITIONS,
  sectionId,
  type PrimitiveField,
  type PrimitiveFieldType,
  type RecordBooleanField,
  type RecordNumberField,
  type SectionDefinition,
} from "@/config/system-config-sections";
import { SETTING_QUERY_PARAM, settingAnchorId } from "@/config/settings-search";
import { summarizeGames, summarizeProviders } from "@/lib/free-spin-selection";

type PickerOption = {
  value: string;
  label: string;
  countryCode?: string;
};

const ISO_COUNTRY_CODES = [
  "AF", "AX", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW", "AU", "AT", "AZ",
  "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BQ", "BA", "BW", "BV", "BR",
  "IO", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "KY", "CF", "TD", "CL", "CN", "CX", "CC",
  "CO", "KM", "CG", "CD", "CK", "CR", "CI", "HR", "CU", "CW", "CY", "CZ", "DK", "DJ", "DM", "DO",
  "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FJ", "FI", "FR", "GF", "PF", "TF",
  "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GP", "GU", "GT", "GG", "GN", "GW", "GY",
  "HT", "HM", "VA", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM",
  "JP", "JE", "JO", "KZ", "KE", "KI", "KP", "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY",
  "LI", "LT", "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MQ", "MR", "MU", "YT", "MX",
  "FM", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI",
  "NE", "NG", "NU", "NF", "MK", "MP", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH",
  "PN", "PL", "PT", "PR", "QA", "RE", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC",
  "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS",
  "SS", "ES", "LK", "SD", "SR", "SJ", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TK",
  "TO", "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "UM", "US", "UY", "UZ", "VU",
  "VE", "VN", "VG", "VI", "WF", "EH", "YE", "ZM", "ZW",
];

const countryDisplayNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const COUNTRY_OPTIONS: PickerOption[] = ISO_COUNTRY_CODES.map((code) => ({
  value: code,
  label: countryDisplayNames?.of(code) ?? code,
})).sort((a, b) => a.label.localeCompare(b.label));

// The IANA zone list and the "what time is it there" preview live in
// ./components/TimezoneSelect, next to the only thing that uses them.

const STATE_OPTIONS: PickerOption[] = [
  { value: "US-AL", label: "Alabama", countryCode: "US" },
  { value: "US-AK", label: "Alaska", countryCode: "US" },
  { value: "US-AZ", label: "Arizona", countryCode: "US" },
  { value: "US-AR", label: "Arkansas", countryCode: "US" },
  { value: "US-CA", label: "California", countryCode: "US" },
  { value: "US-CO", label: "Colorado", countryCode: "US" },
  { value: "US-CT", label: "Connecticut", countryCode: "US" },
  { value: "US-DE", label: "Delaware", countryCode: "US" },
  { value: "US-FL", label: "Florida", countryCode: "US" },
  { value: "US-GA", label: "Georgia", countryCode: "US" },
  { value: "US-HI", label: "Hawaii", countryCode: "US" },
  { value: "US-ID", label: "Idaho", countryCode: "US" },
  { value: "US-IL", label: "Illinois", countryCode: "US" },
  { value: "US-IN", label: "Indiana", countryCode: "US" },
  { value: "US-IA", label: "Iowa", countryCode: "US" },
  { value: "US-KS", label: "Kansas", countryCode: "US" },
  { value: "US-KY", label: "Kentucky", countryCode: "US" },
  { value: "US-LA", label: "Louisiana", countryCode: "US" },
  { value: "US-ME", label: "Maine", countryCode: "US" },
  { value: "US-MD", label: "Maryland", countryCode: "US" },
  { value: "US-MA", label: "Massachusetts", countryCode: "US" },
  { value: "US-MI", label: "Michigan", countryCode: "US" },
  { value: "US-MN", label: "Minnesota", countryCode: "US" },
  { value: "US-MS", label: "Mississippi", countryCode: "US" },
  { value: "US-MO", label: "Missouri", countryCode: "US" },
  { value: "US-MT", label: "Montana", countryCode: "US" },
  { value: "US-NE", label: "Nebraska", countryCode: "US" },
  { value: "US-NV", label: "Nevada", countryCode: "US" },
  { value: "US-NH", label: "New Hampshire", countryCode: "US" },
  { value: "US-NJ", label: "New Jersey", countryCode: "US" },
  { value: "US-NM", label: "New Mexico", countryCode: "US" },
  { value: "US-NY", label: "New York", countryCode: "US" },
  { value: "US-NC", label: "North Carolina", countryCode: "US" },
  { value: "US-ND", label: "North Dakota", countryCode: "US" },
  { value: "US-OH", label: "Ohio", countryCode: "US" },
  { value: "US-OK", label: "Oklahoma", countryCode: "US" },
  { value: "US-OR", label: "Oregon", countryCode: "US" },
  { value: "US-PA", label: "Pennsylvania", countryCode: "US" },
  { value: "US-RI", label: "Rhode Island", countryCode: "US" },
  { value: "US-SC", label: "South Carolina", countryCode: "US" },
  { value: "US-SD", label: "South Dakota", countryCode: "US" },
  { value: "US-TN", label: "Tennessee", countryCode: "US" },
  { value: "US-TX", label: "Texas", countryCode: "US" },
  { value: "US-UT", label: "Utah", countryCode: "US" },
  { value: "US-VT", label: "Vermont", countryCode: "US" },
  { value: "US-VA", label: "Virginia", countryCode: "US" },
  { value: "US-WA", label: "Washington", countryCode: "US" },
  { value: "US-WV", label: "West Virginia", countryCode: "US" },
  { value: "US-WI", label: "Wisconsin", countryCode: "US" },
  { value: "US-WY", label: "Wyoming", countryCode: "US" },
  { value: "IN-AN", label: "Andaman and Nicobar Islands", countryCode: "IN" },
  { value: "IN-AP", label: "Andhra Pradesh", countryCode: "IN" },
  { value: "IN-AR", label: "Arunachal Pradesh", countryCode: "IN" },
  { value: "IN-AS", label: "Assam", countryCode: "IN" },
  { value: "IN-BR", label: "Bihar", countryCode: "IN" },
  { value: "IN-CH", label: "Chandigarh", countryCode: "IN" },
  { value: "IN-CT", label: "Chhattisgarh", countryCode: "IN" },
  { value: "IN-DL", label: "Delhi", countryCode: "IN" },
  { value: "IN-GA", label: "Goa", countryCode: "IN" },
  { value: "IN-GJ", label: "Gujarat", countryCode: "IN" },
  { value: "IN-HR", label: "Haryana", countryCode: "IN" },
  { value: "IN-HP", label: "Himachal Pradesh", countryCode: "IN" },
  { value: "IN-JH", label: "Jharkhand", countryCode: "IN" },
  { value: "IN-KA", label: "Karnataka", countryCode: "IN" },
  { value: "IN-KL", label: "Kerala", countryCode: "IN" },
  { value: "IN-LA", label: "Ladakh", countryCode: "IN" },
  { value: "IN-MH", label: "Maharashtra", countryCode: "IN" },
  { value: "IN-MP", label: "Madhya Pradesh", countryCode: "IN" },
  { value: "IN-MN", label: "Manipur", countryCode: "IN" },
  { value: "IN-ML", label: "Meghalaya", countryCode: "IN" },
  { value: "IN-MZ", label: "Mizoram", countryCode: "IN" },
  { value: "IN-NL", label: "Nagaland", countryCode: "IN" },
  { value: "IN-OD", label: "Odisha", countryCode: "IN" },
  { value: "IN-PB", label: "Punjab", countryCode: "IN" },
  { value: "IN-RJ", label: "Rajasthan", countryCode: "IN" },
  { value: "IN-SK", label: "Sikkim", countryCode: "IN" },
  { value: "IN-TN", label: "Tamil Nadu", countryCode: "IN" },
  { value: "IN-TG", label: "Telangana", countryCode: "IN" },
  { value: "IN-TR", label: "Tripura", countryCode: "IN" },
  { value: "IN-UP", label: "Uttar Pradesh", countryCode: "IN" },
  { value: "IN-UT", label: "Uttarakhand", countryCode: "IN" },
  { value: "IN-WB", label: "West Bengal", countryCode: "IN" },
];

const getPickerLabel = (options: PickerOption[], value: string): string => {
  return options.find((option) => option.value === value)?.label ?? value;
};

const getPickerCodeLabel = (option: PickerOption): string => {
  return option.countryCode ? option.value.replace(`${option.countryCode}-`, "") : option.value;
};

const filterPickerOptions = (options: PickerOption[], searchValue: string): PickerOption[] => {
  const query = searchValue.trim().toLowerCase();
  if (!query) {
    return options.slice(0, 25);
  }

  return options
    .filter((option) => {
      const codeLabel = getPickerCodeLabel(option).toLowerCase();
      return (
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query) ||
        codeLabel.includes(query)
      );
    })
    .slice(0, 25);
};

const normalizeStateSelection = (value: string): string => {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return "";
  if (normalized.includes("-")) return normalized;
  return `US-${normalized}`;
};


const getValueByPath = (obj: unknown, path: string): unknown => {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
};

const setValueByPath = (
  obj: SystemConfig,
  path: string,
  value: unknown,
): SystemConfig => {
  const parts = path.split(".");
  const result = {
    ...(obj as unknown as Record<string, unknown>),
  } as Record<string, unknown>;

  let resultCursor = result;
  let sourceCursor: unknown = obj;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    let sourceValue: unknown = undefined;

    if (sourceCursor && typeof sourceCursor === "object") {
      sourceValue = (sourceCursor as Record<string, unknown>)[key];
    }

    const nextBranch =
      sourceValue && typeof sourceValue === "object" && !Array.isArray(sourceValue)
        ? { ...(sourceValue as Record<string, unknown>) }
        : {};

    resultCursor[key] = nextBranch;
    resultCursor = nextBranch;
    sourceCursor = sourceValue;
  }

  resultCursor[parts[parts.length - 1]] = value;
  return result as unknown as SystemConfig;
};

// Number fields keep "" while editing so they can be cleared. Coerce any left
// empty back to 0 right before persisting, so the API never receives "".
// Duration fields always hold a composed total; clamp them to their minimum so
// a cleared pair can't persist 0 and silently fall back to app defaults.
const coerceEmptyNumberFields = (config: SystemConfig): SystemConfig => {
  let next = config;
  for (const section of SECTION_DEFINITIONS) {
    for (const field of section.fields) {
      if (field.type === "number") {
        if (getValueByPath(next, field.path) === "") {
          next = setValueByPath(next, field.path, 0);
        }
      } else if (field.type === "duration-hm" || field.type === "duration-ms") {
        const raw = getValueByPath(next, field.path);
        const total =
          typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 0;
        const minimum = field.min ?? 1;
        if (total < minimum) {
          next = setValueByPath(next, field.path, minimum);
        } else if (total !== raw) {
          next = setValueByPath(next, field.path, total);
        }
      }
    }
  }
  return next;
};

/**
 * A plain field label.
 *
 * It used to carry an info button that opened a one-setting dialog. That is now
 * the System Settings Guide in the page header: a per-row modal could only show
 * one setting at a time — the wrong shape for settings that only make sense
 * together — and it put a blurred full-screen overlay in front of the editor on
 * every click, which made the page feel slow for the sake of two sentences.
 */
function FieldLabel({
  field,
  className,
}: {
  field: PrimitiveField;
  className?: string;
}) {
  return (
    <Label className={`text-md text-white ${className ?? ""}`.trim()}>
      {field.label}
    </Label>
  );
}

type SystemConfigEditorHandle = {
  handleSave: () => Promise<void>;
};

/** Tab value meaning "show every card". */
const ALL_SECTIONS_TAB = "all";

/** Which card owns a setting path — used to open the right tab on a deep link. */
function findSectionIdForPath(path: string): string | null {
  for (const section of SECTION_DEFINITIONS) {
    if (section.fields.some((field) => field.path === path)) {
      return sectionId(section);
    }
  }
  return null;
}

type EditorProps = {
  initialConfig: SystemConfig;
  isSaving: boolean;
  saveConfig: (config: SystemConfig) => Promise<SystemConfig | null>;
  /** `ALL_SECTIONS_TAB` or one section id — only that card is rendered. */
  activeSection: string;
};

const SystemConfigEditor = forwardRef<SystemConfigEditorHandle, EditorProps>(function SystemConfigEditor({
  initialConfig,
  isSaving,
  saveConfig,
  activeSection,
}: EditorProps, ref) {
  const searchParams = useSearchParams();
  const [draftConfig, setDraftConfig] = useState<SystemConfig>(initialConfig);
  const [committedConfig, setCommittedConfig] = useState<SystemConfig>(initialConfig);
  const [pickerDraftValues, setPickerDraftValues] = useState<Record<string, string>>({});
  const [pickerSearchValues, setPickerSearchValues] = useState<Record<string, string>>({});
  const [openPickerPath, setOpenPickerPath] = useState<string | null>(null);
  // Tracks the currently-saving section by its UI id (not backend key) so two
  // cards that share the same backend `key` (e.g. Bonus Defaults + Welcome
  // Free Spin both → bonus_defaults) show the saving indicator independently.
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [bundleSalePreviewOpen, setBundleSalePreviewOpen] = useState(false);

  // Active FreeSpinConfigs for dropdown selectors (welcome free spin, etc.).
  // Fetched once on editor mount; admin must create configs on the
  // VIP / Spin Configuration page first.
  const [freeSpinConfigs, setFreeSpinConfigs] = useState<FreeSpin[]>([]);
  const [freeSpinConfigsLoading, setFreeSpinConfigsLoading] = useState(false);

  // Deep link from the header settings search: ?setting=<config.path> scrolls
  // that one field into view and rings it briefly, so the admin lands on the
  // control they searched for and not merely on this (very long) page.
  const settingParam = searchParams.get(SETTING_QUERY_PARAM);
  const [highlightedPath, setHighlightedPath] = useState<string | null>(null);

  useEffect(() => {
    if (!settingParam) {
      setHighlightedPath(null);
      return;
    }
    setHighlightedPath(settingParam);

    // One frame so the field has been laid out before we scroll to it.
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(settingAnchorId(settingParam))
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    // The ring is a pointer, not a state — drop it once it has done its job.
    const timer = window.setTimeout(() => setHighlightedPath(null), 2600);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [settingParam]);

  useEffect(() => {
    let cancelled = false;
    setFreeSpinConfigsLoading(true);
    FreeSpinAPI.getAllFreeSpins(true)
      .then((list) => {
        if (!cancelled) setFreeSpinConfigs(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setFreeSpinConfigs([]);
      })
      .finally(() => {
        if (!cancelled) setFreeSpinConfigsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setDraftConfig(initialConfig);
    setCommittedConfig(initialConfig);
    setPickerDraftValues({});
    setPickerSearchValues({});
    setOpenPickerPath(null);
  }, [initialConfig]);

  const onPrimitiveChange = (
    path: string,
    fieldType: PrimitiveFieldType,
    inputValue: string | boolean,
  ) => {
    let nextValue: unknown = inputValue;

    if (fieldType === "number") {
      // Preserve an empty field while editing instead of snapping back to 0.
      // Coerced to a number on save (see handleSectionSave / handleSave).
      if (inputValue === "") {
        nextValue = "";
      } else {
        const numeric = Number(inputValue);
        nextValue = Number.isFinite(numeric) ? numeric : 0;
      }
    }

    if (fieldType === "array-number") {
      const values = String(inputValue)
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value));
      nextValue = values;
    }

    if (fieldType === "array-string") {
      const values = String(inputValue)
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter((value) => value.length > 0);
      nextValue = Array.from(new Set(values));
    }

    setDraftConfig((prev) => setValueByPath(prev, path, nextValue));
  };

  const onRecordValueChange = (
    path: string,
    entryKey: string,
    value: boolean | number,
  ) => {
    setDraftConfig((prev) => {
      const raw = getValueByPath(prev, path);
      const currentRecord =
        raw && typeof raw === "object" && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : {};

      return setValueByPath(prev, path, {
        ...currentRecord,
        [entryKey]: value,
      });
    });
  };

  const onArrayNumberValueChange = (
    path: string,
    index: number,
    nextRawValue: string,
  ) => {
    setDraftConfig((prev) => {
      const raw = getValueByPath(prev, path);
      const currentValues = Array.isArray(raw)
        ? raw.map((item) => Number(item)).filter((item) => Number.isFinite(item))
        : [];

      const nextValues = [...currentValues];
      const numeric = Number(nextRawValue);
      nextValues[index] = Number.isFinite(numeric) ? numeric : 0;

      return setValueByPath(prev, path, nextValues);
    });
  };

  const addArrayNumberValue = (path: string) => {
    setDraftConfig((prev) => {
      const raw = getValueByPath(prev, path);
      const currentValues = Array.isArray(raw)
        ? raw.map((item) => Number(item)).filter((item) => Number.isFinite(item))
        : [];

      return setValueByPath(prev, path, [...currentValues, 0]);
    });
  };

  const removeArrayNumberValue = (path: string, index: number) => {
    setDraftConfig((prev) => {
      const raw = getValueByPath(prev, path);
      const currentValues = Array.isArray(raw)
        ? raw.map((item) => Number(item)).filter((item) => Number.isFinite(item))
        : [];
      const nextValues = currentValues.filter((_, itemIndex) => itemIndex !== index);

      return setValueByPath(prev, path, nextValues);
    });
  };

  const addPickerValue = (path: string, value: string) => {
    const normalizedValue =
      path.includes("restricted_state_codes")
        ? normalizeStateSelection(value)
        : value.trim().toUpperCase();
    if (!normalizedValue) return;

    setDraftConfig((prev) => {
      const raw = getValueByPath(prev, path);
      const currentValues = Array.isArray(raw)
        ? raw
          .filter((item): item is string => typeof item === "string")
          .map((item) =>
            path.includes("restricted_state_codes")
              ? normalizeStateSelection(item)
              : item.trim().toUpperCase(),
          )
        : [];

      if (currentValues.includes(normalizedValue)) {
        return prev;
      }

      return setValueByPath(prev, path, [...currentValues, normalizedValue]);
    });
  };

  const removePickerValue = (path: string, value: string) => {
    const normalizedValue =
      path.includes("restricted_state_codes")
        ? normalizeStateSelection(value)
        : value.trim().toUpperCase();
    setDraftConfig((prev) => {
      const raw = getValueByPath(prev, path);
      const currentValues = Array.isArray(raw)
        ? raw
          .filter((item): item is string => typeof item === "string")
          .map((item) =>
            path.includes("restricted_state_codes")
              ? normalizeStateSelection(item)
              : item.trim().toUpperCase(),
          )
        : [];

      const nextConfig = setValueByPath(
        prev,
        path,
        currentValues.filter((item) => item !== normalizedValue),
      );

      if (!path.includes("allowed_country_codes")) {
        return nextConfig;
      }

      const nextAllowedCountries = new Set(
        currentValues.filter((item) => item !== normalizedValue),
      );
      const restrictedStateRaw = getValueByPath(nextConfig, "geofence.restricted_state_codes");
      const restrictedStates = Array.isArray(restrictedStateRaw)
        ? restrictedStateRaw
          .filter((item): item is string => typeof item === "string")
          .map(normalizeStateSelection)
          .filter((item) => nextAllowedCountries.has(item.split("-")[0]))
        : [];

      return setValueByPath(nextConfig, "geofence.restricted_state_codes", restrictedStates);
    });
  };

  const handleSave = async () => {
    const saved = await saveConfig(coerceEmptyNumberFields(draftConfig));
    if (!saved) return;
    setDraftConfig(saved);
    setCommittedConfig(saved);
  };

  const handleSectionSave = async (section: SectionDefinition) => {
    const { key: sectionKey, extraKeys = [] } = section;
    setSavingSectionId(sectionId(section));

    const allKeys = [sectionKey, ...extraKeys];
    const extraUpdates = allKeys.reduce(
      (acc, k) => ({ ...acc, [k]: draftConfig[k] }),
      {} as Partial<SystemConfig>,
    );

    const nextConfig = coerceEmptyNumberFields({
      ...committedConfig,
      ...extraUpdates,
    } as SystemConfig);

    try {
      const saved = await saveConfig(nextConfig);
      if (!saved) return;

      setCommittedConfig(saved);
      setDraftConfig((prev) => {
        const updates = allKeys.reduce(
          (acc, k) => ({ ...acc, [k]: saved[k] }),
          {} as Partial<SystemConfig>,
        );
        return { ...prev, ...updates };
      });
    } finally {
      setSavingSectionId(null);
    }
  };

  useImperativeHandle(ref, () => ({
    handleSave,
  }));

  const visibleSections =
    activeSection === ALL_SECTIONS_TAB
      ? SECTION_DEFINITIONS
      : SECTION_DEFINITIONS.filter((section) => sectionId(section) === activeSection);

  return (
    <div
      className={
        activeSection === ALL_SECTIONS_TAB
          ? "columns-1 xl:columns-2 gap-4 [column-fill:_balance]"
          : "columns-1 max-w-4xl"
      }
    >
      {visibleSections.map((section) => (
        <div
          key={sectionId(section)}
          className="bg-[#191D24] rounded-xl p-4 mb-4 break-inside-avoid"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex items-center justify-center shrink-0 animate-ping">
              <div className="w-2 h-2 rounded-full bg-[#c742fc]" />
              <div className="absolute inset-0 rounded-full bg-[#B93DEB]/40 blur-md animate-ping" />
            </div>
            <h2 className="text-white text-md font-bold">{section.title}</h2>
          </div>
          <div
            className={
              section.layout === "grid-4"
                ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
                : section.layout === "grid-3"
                  ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                  : section.layout === "grid-2"
                    ? "grid grid-cols-1 md:grid-cols-2 gap-4"
                    : section.layout === "rows"
                      ? "space-y-3"
                      : "space-y-4"
            }
          >
            {section.fields.map((field) => {
              // Each branch below returns this field's own root element. It is
              // tagged rather than wrapped: a wrapper div would become the grid
              // item and strip the col-span classes some branches set on their
              // root, so the id/anchor styling is merged onto that root instead.
              const rendered = ((): React.ReactNode => {
              const value = getValueByPath(draftConfig, field.path);

              if (field.type === "language-select") {
                const selectedLanguage = value === "es" ? "es" : "en";

                return (
                  <div key={field.path} className="space-y-2">
                    <Label className="text-md text-white">{field.label}</Label>
                    <Select
                      value={selectedLanguage}
                      onValueChange={(nextValue) =>
                        onPrimitiveChange(field.path, field.type, nextValue)
                      }
                    >
                      <SelectTrigger className="w-full bg-[#242B35] border-[#2C323D] text-white">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242B35] border-[#2C323D] text-white">
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (field.type === "timezone-select") {
                return (
                  <div key={field.path} className="space-y-2">
                    <Label className="text-md text-white">{field.label}</Label>
                    <TimezoneSelect
                      value={typeof value === "string" ? value : ""}
                      onChange={(next) => onPrimitiveChange(field.path, field.type, next)}
                    />
                  </div>
                );
              }

              if (field.type === "select") {
                const options = field.options ?? [];
                // Anything unrecognised — including a value stored before the
                // option list existed — falls back to the first option, which
                // is always the documented default.
                const selected =
                  options.find((option) => option.value === value)?.value ??
                  options[0]?.value ??
                  "";

                return (
                  <div key={field.path} className="space-y-2">
                    <FieldLabel field={field} />
                    <Select
                      value={selected}
                      onValueChange={(nextValue) =>
                        onPrimitiveChange(field.path, field.type, nextValue)
                      }
                    >
                      <SelectTrigger className="w-full bg-[#242B35] border-[#2C323D] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242B35] border-[#2C323D] text-white">
                        {options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (field.type === "device-limit-mode-select") {
                // Anything unrecognised — including a config saved before this
                // field existed — reads as DEFAULT, the flat policy.
                const selectedMode =
                  value === "SUBSCRIPTION" ? "SUBSCRIPTION" : "DEFAULT";

                return (
                  <div key={field.path} className="space-y-2">
                    <Label className="text-md text-white">{field.label}</Label>
                    <Select
                      value={selectedMode}
                      onValueChange={(nextValue) =>
                        onPrimitiveChange(field.path, field.type, nextValue)
                      }
                    >
                      <SelectTrigger className="w-full bg-[#242B35] border-[#2C323D] text-white">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242B35] border-[#2C323D] text-white">
                        <SelectItem value="DEFAULT">
                          Same for everyone — use the default below
                        </SelectItem>
                        <SelectItem value="SUBSCRIPTION">
                          Per subscription tier
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400">
                      {selectedMode === "DEFAULT"
                        ? "Every player gets the same number of devices. Per-tier device counts are ignored, and the players' pricing page hides the Devices row."
                        : "Each tier's device count is set in Users → Subscription Tier Management. Tiers left at 0 fall back to the default below."}
                    </p>
                  </div>
                );
              }

              if (field.type === "device-limit-strategy-select") {
                // Anything unrecognised (including an unset config saved before
                // this field existed) reads as ASK — the only option that never
                // signs a device out without the player agreeing to it.
                const selectedStrategy =
                  value === "EVICT_OLDEST"
                    ? "EVICT_OLDEST"
                    : value === "BLOCK"
                      ? "BLOCK"
                      : "ASK";

                return (
                  <div key={field.path} className="space-y-2">
                    <Label className="text-md text-white">{field.label}</Label>
                    <Select
                      value={selectedStrategy}
                      onValueChange={(nextValue) =>
                        onPrimitiveChange(field.path, field.type, nextValue)
                      }
                    >
                      <SelectTrigger className="w-full bg-[#242B35] border-[#2C323D] text-white">
                        <SelectValue placeholder="Select behaviour" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242B35] border-[#2C323D] text-white">
                        <SelectItem value="ASK">
                          Ask — let the player pick which device to sign out
                        </SelectItem>
                        <SelectItem value="EVICT_OLDEST">
                          Sign out the least recently used device
                        </SelectItem>
                        <SelectItem value="BLOCK">
                          Block the login until a device is freed
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              }

              if (field.type === "free-spin-config-select") {
                // Sentinel "__none" because Radix Select disallows an empty string value.
                const NONE = "__none";
                const currentId = typeof value === "string" && value ? value : NONE;
                const selected = freeSpinConfigs.find((c) => c.id === currentId);

                return (
                  <div key={field.path} className="space-y-2">
                    <Label className="text-md text-white">{field.label}</Label>
                    <Select
                      value={currentId}
                      onValueChange={(nextValue) =>
                        onPrimitiveChange(
                          field.path,
                          field.type,
                          nextValue === NONE ? "" : nextValue,
                        )
                      }
                      disabled={freeSpinConfigsLoading}
                    >
                      <SelectTrigger className="w-full bg-[#242B35] border-[#2C323D] text-white">
                        <SelectValue
                          placeholder={
                            freeSpinConfigsLoading
                              ? "Loading templates..."
                              : "Select a Free Spin template"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-[#242B35] border-[#2C323D] text-white">
                        <SelectItem value={NONE}>None — feature disabled</SelectItem>
                        {freeSpinConfigs.map((cfg) => (
                          <SelectItem key={cfg.id} value={cfg.id}>
                            {cfg.name} — {cfg.numberOfFreeSpins} spins ·{" "}
                            {summarizeProviders(cfg)} · {summarizeGames(cfg)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!freeSpinConfigsLoading && freeSpinConfigs.length === 0 && (
                      <p className="text-xs text-amber-400">
                        No active templates. Create one under VIP / Spin Configuration first.
                      </p>
                    )}
                    {selected && !selected.isActive && (
                      <p className="text-xs text-amber-400">
                        Selected template is currently inactive — grants will be skipped.
                      </p>
                    )}
                  </div>
                );
              }

              if (field.type === "ip-list") {
                const listValue = Array.isArray(value)
                  ? value.filter((item): item is string => typeof item === "string")
                  : [];

                return (
                  <IpAllowlistField
                    key={field.path}
                    label={field.label}
                    values={listValue}
                    onChange={(next) =>
                      setDraftConfig((prev) => setValueByPath(prev, field.path, next))
                    }
                    {...(field.path === "geofence.allowed_ips"
                      ? {
                          emptyHint: "Empty — every visitor goes through the geofence rules.",
                          filledHint:
                            "These addresses skip every geofence rule (country, state, unknown location, VPN). Staff only, never players.",
                        }
                      : {})}
                  />
                );
              }

              if (field.type === "datetime") {
                // Stored as ISO UTC, edited as local wall-clock. <input
                // type="datetime-local" speaks "YYYY-MM-DDTHH:mm" with no zone,
                // so both directions convert explicitly — an operator in Chicago
                // must get the hour they picked, not that hour read as UTC.
                const iso = typeof value === "string" ? value : "";
                const toLocalInput = (input: string) => {
                  if (!input) return "";
                  const d = new Date(input);
                  if (Number.isNaN(d.getTime())) return "";
                  const pad = (n: number) => String(n).padStart(2, "0");
                  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
                    d.getDate(),
                  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                };

                return (
                  <div key={field.path} className="space-y-2">
                    <FieldLabel field={field} />
                    <input
                      type="datetime-local"
                      value={toLocalInput(iso)}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const next = raw ? new Date(raw).toISOString() : "";
                        setDraftConfig((prev) =>
                          setValueByPath(prev, field.path, next || null),
                        );
                      }}
                      className="w-full rounded-md border border-[#2C323D] bg-[#242B35] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    {iso ? (
                      <p className="text-[11px] text-gray-500">
                        Saved as {new Date(iso).toUTCString()}
                      </p>
                    ) : null}
                  </div>
                );
              }

              if (field.type === "textarea") {
                return (
                  <div key={field.path} className="space-y-2 md:col-span-2 xl:col-span-3">
                    <FieldLabel field={field} />
                    <textarea
                      rows={field.rows ?? 4}
                      value={typeof value === "string" ? value : ""}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        onPrimitiveChange(field.path, field.type, event.target.value)
                      }
                      className="w-full resize-y rounded-md border border-[#2C323D] bg-[#242B35] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                );
              }

              if (field.type === "maintenance-duration") {
                const minutes =
                  typeof value === "number" && Number.isFinite(value) && value > 0
                    ? Math.floor(value)
                    : 0;

                // The windows an operator actually picks. Anything else is
                // typed into the box beside them, which is why "custom" is not
                // a chip — a chip that opens an input is a worse version of an
                // input that is already there.
                const PRESETS: Array<{ label: string; value: number }> = [
                  { label: "No timer", value: 0 },
                  { label: "30 min", value: 30 },
                  { label: "1 hour", value: 60 },
                  { label: "2 hours", value: 120 },
                ];

                const setMinutes = (next: number) => {
                  const safe = Number.isFinite(next) && next > 0 ? Math.floor(next) : 0;
                  setDraftConfig((prev) => setValueByPath(prev, field.path, safe));
                };

                const maintenanceOn = Boolean(
                  getValueByPath(committedConfig, "general.maintenance_mode"),
                );
                const savedEndsAt = getValueByPath(
                  committedConfig,
                  "general.maintenance_ends_at",
                );
                const savedType = getValueByPath(
                  committedConfig,
                  "general.maintenance_type",
                );
                const savedStartsAt = getValueByPath(
                  committedConfig,
                  "general.maintenance_starts_at",
                );

                return (
                  <div key={field.path} className="space-y-2 md:col-span-2 xl:col-span-3">
                    <FieldLabel field={field} />
                    <div className="flex flex-wrap items-center gap-2">
                      {PRESETS.map((preset) => {
                        const active = minutes === preset.value;
                        return (
                          <button
                            key={preset.label}
                            // Default button type is "submit"; inside the
                            // settings form that would save the page.
                            type="button"
                            onClick={() => setMinutes(preset.value)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              active
                                ? "border-purple-500 bg-purple-500/20 text-white"
                                : "border-[#2C323D] bg-[#242B35] text-gray-300 hover:border-purple-500/50"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                      <div className="relative w-32">
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          value={minutes === 0 ? "" : minutes}
                          placeholder="Custom"
                          onChange={(event) => setMinutes(Number(event.target.value))}
                          className="bg-[#242B35] border-[#2C323D] text-white pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          aria-label={`${field.label} — minutes`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                          min
                        </span>
                      </div>
                    </div>
                    {minutes === 0 && (
                      <p className="text-xs text-gray-400">
                        No countdown will be shown — the curtain says the site is down
                        without promising when it returns.
                      </p>
                    )}
                    <MaintenanceWindowStatus
                      maintenanceOn={maintenanceOn}
                      maintenanceType={typeof savedType === "string" ? savedType : null}
                      startsAt={typeof savedStartsAt === "string" ? savedStartsAt : null}
                      endsAt={typeof savedEndsAt === "string" ? savedEndsAt : null}
                    />
                  </div>
                );
              }

              if (field.type === "boolean") {
                const shouldSpanFullWidth = section.layout !== undefined;

                return (
                  <div
                    key={field.path}
                    className={`flex items-center justify-between gap-4${shouldSpanFullWidth
                      ? section.layout === "grid-4"
                        ? " md:col-span-2 xl:col-span-4"
                        : section.layout === "grid-3"
                          ? " md:col-span-2 xl:col-span-3"
                          : " md:col-span-2"
                      : ""
                      }`}
                  >
                    <FieldLabel field={field} />
                    <Switch
                      checked={Boolean(value)}
                      onCheckedChange={(checked) =>
                        onPrimitiveChange(field.path, field.type, checked)
                      }
                      className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                    />
                  </div>
                );
              }

              if (field.type === "array-number") {
                const arrayValues = Array.isArray(value)
                  ? value
                    .map((item) => Number(item))
                    .filter((item) => Number.isFinite(item))
                  : [];

                const shouldSpanFullWidth = section.layout !== undefined;

                return (
                  <div
                    key={field.path}
                    className={`space-y-2${shouldSpanFullWidth
                      ? section.layout === "grid-4"
                        ? " md:col-span-2 xl:col-span-4"
                        : section.layout === "grid-3"
                          ? " md:col-span-2 xl:col-span-3"
                          : " md:col-span-2"
                      : ""
                      }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-md text-white">{field.label}</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 border-gray-600 text-gray-200 hover:bg-[#232834]"
                        onClick={() => addArrayNumberValue(field.path)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                      {arrayValues.length === 0 ? (
                        <p className="text-md text-gray-400">No segment values configured</p>
                      ) : (
                        arrayValues.map((itemValue, index) => (
                          <div
                            key={`${field.path}-${index}`}
                            className="flex items-center gap-2"
                          >
                            <Input
                              type="number"
                              value={itemValue}
                              min={0}
                              step="0.01"
                              onChange={(event) =>
                                onArrayNumberValueChange(
                                  field.path,
                                  index,
                                  event.target.value,
                                )
                              }
                              className="bg-[#242B35] border-[#2C323D] text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 border-red-700 text-red-200 hover:bg-red-900/30"
                              onClick={() => removeArrayNumberValue(field.path, index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              }

              if (field.type === "array-string") {
                const arrayValues = Array.isArray(value)
                  ? value.filter((item): item is string => typeof item === "string")
                  : [];
                const mergedValue = arrayValues.join(", ");
                const shouldSpanFullWidth = section.layout !== undefined;

                return (
                  <div
                    key={field.path}
                    className={`space-y-2${shouldSpanFullWidth
                        ? section.layout === "grid-4"
                          ? " md:col-span-2 xl:col-span-4"
                          : section.layout === "grid-3"
                            ? " md:col-span-2 xl:col-span-3"
                            : " md:col-span-2"
                        : ""
                      }`}
                  >
                    <Label className="text-md text-white">{field.label}</Label>
                    <Input
                      type="text"
                      value={mergedValue}
                      onChange={(event) =>
                        onPrimitiveChange(field.path, field.type, event.target.value)
                      }
                      className="bg-[#242B35] border-[#2C323D] text-white"
                      placeholder="US, IN"
                    />
                  </div>
                );
              }

              if (field.type === "country-picker" || field.type === "state-picker") {
                const selectedCountryValues = Array.isArray(getValueByPath(draftConfig, "geofence.allowed_country_codes"))
                  ? (getValueByPath(draftConfig, "geofence.allowed_country_codes") as unknown[])
                    .filter((item): item is string => typeof item === "string")
                    .map((item) => item.trim().toUpperCase())
                    .filter(Boolean)
                  : [];
                const stateCountrySet = new Set(selectedCountryValues);
                const options =
                  field.type === "country-picker"
                    ? COUNTRY_OPTIONS
                    : STATE_OPTIONS.filter(
                      (option) => option.countryCode && stateCountrySet.has(option.countryCode),
                    );
                const selectedValues = Array.isArray(value)
                  ? value
                    .filter((item): item is string => typeof item === "string")
                    .map((item) =>
                      field.type === "state-picker"
                        ? normalizeStateSelection(item)
                        : item.trim().toUpperCase(),
                    )
                    .filter(Boolean)
                  : [];
                const availableOptions = options.filter(
                  (option) => !selectedValues.includes(option.value),
                );
                const searchValue = pickerSearchValues[field.path] ?? "";
                const filteredOptions = filterPickerOptions(availableOptions, searchValue);
                const selectedDraftValue = pickerDraftValues[field.path] ?? "";
                const selectedDraftOption = availableOptions.find(
                  (option) => option.value === selectedDraftValue,
                );
                const canOpenOptions = availableOptions.length > 0;
                const statePickerBlocked =
                  field.type === "state-picker" && selectedCountryValues.length === 0;
                const shouldSpanFullWidth = section.layout !== undefined;

                return (
                  <div
                    key={field.path}
                    className={`space-y-3${shouldSpanFullWidth
                        ? section.layout === "grid-4"
                          ? " md:col-span-2 xl:col-span-4"
                          : section.layout === "grid-3"
                            ? " md:col-span-2 xl:col-span-3"
                            : " md:col-span-2"
                        : ""
                      }`}
                  >
                    <Label className="text-md text-white">{field.label}</Label>
                    <div className="rounded-xl border border-[#2C323D] bg-[#171B23] p-3">
                      <div className="flex flex-wrap gap-2">
                        {selectedValues.length === 0 ? (
                          <p className="text-sm text-gray-400">
                            No {field.type === "country-picker" ? "countries" : "states"} selected
                          </p>
                        ) : (
                          selectedValues.map((selectedValue) => (
                            <span
                              key={selectedValue}
                              className="inline-flex items-center gap-2 rounded-full border border-[#3A4659] bg-[#121722] px-3 py-1.5 text-sm font-medium text-gray-200"
                            >
                              <span>
                                {getPickerLabel(options, selectedValue)}
                                <span className="ml-1 text-xs text-gray-500">
                                  {selectedValue.includes("-")
                                    ? selectedValue.split("-").slice(1).join("-")
                                    : selectedValue}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => removePickerValue(field.path, selectedValue)}
                                className="rounded-full p-0.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400"
                                aria-label={`Remove ${selectedValue}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                      <div className="relative mt-3 flex gap-2">
                        <div className="relative flex-1">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                          <Input
                            type="text"
                            value={searchValue}
                            onFocus={() => {
                              if (canOpenOptions) setOpenPickerPath(field.path);
                            }}
                            onChange={(event) => {
                              setPickerSearchValues((prev) => ({
                                ...prev,
                                [field.path]: event.target.value,
                              }));
                              setPickerDraftValues((prev) => ({
                                ...prev,
                                [field.path]: "",
                              }));
                              if (canOpenOptions) setOpenPickerPath(field.path);
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") return;
                              event.preventDefault();
                              const nextOption = selectedDraftOption ?? filteredOptions[0];
                              if (!nextOption) return;
                              addPickerValue(field.path, nextOption.value);
                              setPickerDraftValues((prev) => ({ ...prev, [field.path]: "" }));
                              setPickerSearchValues((prev) => ({ ...prev, [field.path]: "" }));
                              setOpenPickerPath(null);
                            }}
                            disabled={!canOpenOptions}
                            className="h-10 bg-[#11141A] border-[#2C323D] pl-9 text-white placeholder:text-gray-500"
                            placeholder={
                              statePickerBlocked
                                ? "Select allowed country first"
                                : availableOptions.length === 0
                                  ? "All options selected"
                                  : field.type === "country-picker"
                                    ? "Search country"
                                    : "Search state"
                            }
                          />
                          {selectedDraftOption ? (
                            <p className="mt-1 text-xs text-gray-400">
                              Selected: {selectedDraftOption.label} ({getPickerCodeLabel(selectedDraftOption)})
                            </p>
                          ) : null}
                          {openPickerPath === field.path && canOpenOptions ? (
                            <div className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-lg border border-[#2C323D] bg-[#11141A] py-1 shadow-xl">
                              {filteredOptions.length === 0 ? (
                                <div className="px-3 py-2 text-sm text-gray-400">No matching option</div>
                              ) : (
                                filteredOptions.map((option) => {
                                  const isSelected = selectedDraftValue === option.value;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onMouseDown={(event) => event.preventDefault()}
                                      onClick={() => {
                                        setPickerDraftValues((prev) => ({
                                          ...prev,
                                          [field.path]: option.value,
                                        }));
                                        setPickerSearchValues((prev) => ({
                                          ...prev,
                                          [field.path]: `${option.label} (${getPickerCodeLabel(option)})`,
                                        }));
                                        setOpenPickerPath(null);
                                      }}
                                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[#242B35] ${isSelected ? "bg-[#242B35] text-white" : "text-gray-200"
                                        }`}
                                    >
                                      <span>
                                        {option.label}
                                        <span className="ml-1 text-xs text-gray-500">
                                          ({getPickerCodeLabel(option)})
                                        </span>
                                      </span>
                                      {isSelected ? <Check className="h-4 w-4 text-[#A855F7]" /> : null}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 border-[#8B5CF6]/40 bg-[#8B5CF6]/10 px-4 text-white hover:bg-[#8B5CF6]/20"
                          disabled={!selectedDraftValue}
                          onClick={() => {
                            const nextValue = selectedDraftValue;
                            if (!nextValue) return;
                            addPickerValue(field.path, nextValue);
                            setPickerDraftValues((prev) => ({
                              ...prev,
                              [field.path]: "",
                            }));
                            setPickerSearchValues((prev) => ({
                              ...prev,
                              [field.path]: "",
                            }));
                            setOpenPickerPath(null);
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }

              if (field.type === "record-boolean" || field.type === "record-number") {
                const rawRecord = getValueByPath(draftConfig, field.path);
                const record =
                  rawRecord &&
                    typeof rawRecord === "object" &&
                    !Array.isArray(rawRecord)
                    ? (rawRecord as Record<string, unknown>)
                    : {};
                const entries = Object.entries(record);

                // provider flags → 2 cols, category flags → 3 cols, others → stack
                const isProvider = field.path.includes("provider_enable_flags");
                const isCategory = field.path.includes("category_enable_flags");
                const gridClass = isProvider
                  ? "grid grid-cols-2 gap-2"
                  : isCategory
                    ? "grid grid-cols-3 gap-2"
                    : "space-y-2";

                return (
                  <div key={field.path} className="space-y-2">
                    <Label className="text-md text-white">{field.label}</Label>
                    <div className={gridClass}>
                      {entries.length === 0 ? (
                        <p className="text-md text-gray-400">No values configured</p>
                      ) : (
                        entries.map(([entryKey, entryValue]) => (
                          <div
                            key={entryKey}
                            className="flex items-center justify-between gap-3 bg-[#242B35] border border-[#2C323D] rounded-lg px-3 py-2"
                          >
                            <span className="text-md text-gray-200">{entryKey.charAt(0).toUpperCase() + entryKey.slice(1)}</span>
                            {field.type === "record-boolean" ? (
                              <Switch
                                checked={Boolean(entryValue)}
                                onCheckedChange={(checked) =>
                                  onRecordValueChange(field.path, entryKey, checked)
                                }
                                className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                              />
                            ) : (
                              <Input
                                type="number"
                                min={field.min}
                                max={field.max}
                                step={field.step ?? "1"}
                                value={
                                  typeof entryValue === "number"
                                    ? entryValue
                                    : Number(entryValue) || 0
                                }
                                onChange={(event) => {
                                  const numeric = Number(event.target.value);
                                  onRecordValueChange(
                                    field.path,
                                    entryKey,
                                    Number.isFinite(numeric) ? numeric : 0,
                                  );
                                }}
                                className="w-40 bg-[#1F252E] border-[#2C323D] text-white h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              }

              if (field.type === "duration-hm" || field.type === "duration-ms") {
                const isHm = field.type === "duration-hm";
                const total =
                  typeof value === "number" && Number.isFinite(value) && value > 0
                    ? Math.floor(value)
                    : 0;
                const major = Math.floor(total / 60);
                const minor = total % 60;
                const majorLabel = isHm ? "hr" : "min";
                const minorLabel = isHm ? "min" : "sec";

                const setTotal = (nextMajor: number, nextMinor: number) => {
                  const safeMajor =
                    Number.isFinite(nextMajor) && nextMajor > 0 ? Math.floor(nextMajor) : 0;
                  const safeMinor =
                    Number.isFinite(nextMinor) && nextMinor > 0 ? Math.floor(nextMinor) : 0;
                  setDraftConfig((prev) =>
                    setValueByPath(prev, field.path, safeMajor * 60 + safeMinor),
                  );
                };

                // The countdown lives inside the idle window; warn when it can't.
                const idleRaw = getValueByPath(draftConfig, "security.idle_logout_minutes");
                const idleSeconds =
                  typeof idleRaw === "number" && Number.isFinite(idleRaw) ? idleRaw * 60 : 0;
                const warningTooLong =
                  field.path === "security.idle_warning_seconds" &&
                  idleSeconds > 0 &&
                  total >= idleSeconds;

                const durationInputClass =
                  "bg-[#242B35] border-[#2C323D] text-white pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
                const unitClass =
                  "absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none";

                return (
                  <div key={field.path} className="space-y-2">
                    <Label className="text-md text-white">{field.label}</Label>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          value={major}
                          onChange={(event) =>
                            setTotal(Number(event.target.value), minor)
                          }
                          className={durationInputClass}
                          aria-label={`${field.label} — ${majorLabel}`}
                        />
                        <span className={unitClass}>{majorLabel}</span>
                      </div>
                      <div className="relative flex-1">
                        <Input
                          type="number"
                          min={0}
                          max={59}
                          step="1"
                          value={minor}
                          onChange={(event) =>
                            setTotal(major, Number(event.target.value))
                          }
                          className={durationInputClass}
                          aria-label={`${field.label} — ${minorLabel}`}
                        />
                        <span className={unitClass}>{minorLabel}</span>
                      </div>
                    </div>
                    {total === 0 && (
                      <p className="text-xs text-amber-400">
                        Required — will be saved as the minimum ({isHm ? "1 min" : "1 sec"}).
                      </p>
                    )}
                    {warningTooLong && (
                      <p className="text-xs text-amber-400">
                        Countdown should be shorter than the idle auto-logout — the
                        app caps it just below the logout time.
                      </p>
                    )}
                  </div>
                );
              }

              // `datetime` never reaches here — it returns from its own branch
              // above, which converts between the stored ISO instant and the
              // local wall-clock the input speaks.
              const inputType = field.type === "number" ? "number" : "text";

              const inputValue = value ?? "";

              // "rows" layout: label on the left, input on the right (like the
              // Geofence toggles). Otherwise stack label above the input.
              if (section.layout === "rows") {
                return (
                  <div
                    key={field.path}
                    className="flex items-center justify-between gap-4"
                  >
                    <FieldLabel field={field} />
                    <Input
                      type={inputType}
                      min={field.type === "number" ? field.min : undefined}
                      max={field.type === "number" ? field.max : undefined}
                      step={field.type === "number" ? field.step ?? "1" : undefined}
                      value={inputValue as string | number}
                      onChange={(event) =>
                        onPrimitiveChange(field.path, field.type, event.target.value)
                      }
                      className={`w-40 shrink-0 bg-[#242B35] border-[#2C323D] text-white${
                        field.type === "number"
                          ? " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          : ""
                      }`}
                    />
                  </div>
                );
              }

              // In per-tier mode the platform default stops being THE limit and
              // becomes a fallback for tiers left at 0. Dimmed to say so at a
              // glance, but deliberately still editable — a tier at 0 depends on
              // this number, so disabling it would strand anyone needing to
              // change it.
              const isDemotedDeviceDefault =
                field.path === "security.allow_number_of_devices" &&
                getValueByPath(draftConfig, "security.device_limit_mode") ===
                  "SUBSCRIPTION";

              return (
                <div
                  key={field.path}
                  className={`space-y-2 transition-opacity ${
                    isDemotedDeviceDefault ? "opacity-50 focus-within:opacity-100" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FieldLabel field={field} />
                    {isDemotedDeviceDefault && (
                      <span className="text-xs font-normal text-gray-400">
                        (fallback only)
                      </span>
                    )}
                  </div>
                  <Input
                    type={inputType}
                    min={field.type === "number" ? field.min : undefined}
                    max={field.type === "number" ? field.max : undefined}
                    step={field.type === "number" ? field.step ?? "1" : undefined}
                    value={inputValue as string | number}
                    onChange={(event) =>
                      onPrimitiveChange(field.path, field.type, event.target.value)
                    }
                    className={`bg-[#242B35] border-[#2C323D] text-white${
                      field.type === "number"
                        ? " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        : ""
                    }`}
                  />
                  {isDemotedDeviceDefault && (
                    <p className="text-xs text-gray-400">
                      Each tier sets its own device count. This only applies to
                      tiers left at 0.
                    </p>
                  )}
                </div>
              );
              })();

              if (!isValidElement(rendered)) return rendered;

              const element = rendered as ReactElement<Record<string, unknown>>;
              const isHighlighted = highlightedPath === field.path;

              return cloneElement(element, {
                key: field.path,
                id: settingAnchorId(field.path),
                "data-setting-path": field.path,
                className: [
                  (element.props.className as string | undefined) ?? "",
                  // Clears the sticky page header when scrolled to.
                  "scroll-mt-28 rounded-lg transition-shadow duration-500",
                  isHighlighted
                    ? "ring-2 ring-[#B93DEB] ring-offset-2 ring-offset-[#191D24]"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" "),
              });
            })}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            {/* Preview reads the DRAFT config, so it shows what is currently
                typed — including unsaved edits. That is the point: check the
                wording before committing it. */}
            {section.preview === "bundle-sale" && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 border-[#B93DEB]/50 bg-transparent px-3 text-[#D9A6F5] hover:bg-[#B93DEB]/10 hover:text-white"
                onClick={() => setBundleSalePreviewOpen(true)}
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Preview
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3"
              onClick={() => handleSectionSave(section)}
              disabled={isSaving || savingSectionId !== null}
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {savingSectionId === sectionId(section) ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ))}

      {/* Fed from `draftConfig`, so the preview reflects what is typed right
          now rather than what is stored — checking copy after saving it would
          defeat the purpose. */}
      <BundleSalePreviewModal
        open={bundleSalePreviewOpen}
        onClose={() => setBundleSalePreviewOpen(false)}
        title={String(
          getValueByPath(draftConfig, "promotion_defaults.bundle_sale_title") ?? "",
        )}
        subtitle={String(
          getValueByPath(draftConfig, "promotion_defaults.bundle_sale_subtitle") ?? "",
        )}
      />

    </div>
  );
});


export default function SystemConfigurationPage() {
  const { config, meta, isLoading, isSaving, fetchConfig, saveConfig } =
    useSystemConfigStore();
  const editorRef = useRef<SystemConfigEditorHandle>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  // Card filter. "All" is the default so the page looks as it always did;
  // picking a tab narrows the grid to that one card.
  const searchParams = useSearchParams();
  const settingParam = searchParams.get(SETTING_QUERY_PARAM);
  const tabForDeepLink = (param: string | null) =>
    param ? (findSectionIdForPath(param) ?? ALL_SECTIONS_TAB) : ALL_SECTIONS_TAB;
  const [activeSection, setActiveSection] = useState<string>(() =>
    tabForDeepLink(settingParam),
  );
  // A deep link from the global settings search must land on a visible card.
  // Adjust-on-change during render (the React-sanctioned pattern) rather than
  // in an effect, so the first paint already shows the right tab.
  const [seenSettingParam, setSeenSettingParam] = useState(settingParam);
  if (settingParam !== seenSettingParam) {
    setSeenSettingParam(settingParam);
    if (settingParam) {
      setActiveSection(tabForDeepLink(settingParam));
    }
  }

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const lastUpdatedLabel = (() => {
    if (!meta?.updatedAt) return null;
    const date = new Date(meta.updatedAt);
    if (Number.isNaN(date.getTime())) return meta.updatedAt;
    return date.toLocaleString();
  })();

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-4">
      <div className="bg-[#191D24] mb-3 md:mb-4 px-3 md:px-4 py-3 rounded-lg flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="min-w-0">
          <h1 className="text-base font-normal text-white">
            Settings / System Configuration
          </h1>
          {meta && (
            <p className="text-xs md:text-md text-gray-400 mt-1">
              Key: {meta.key} | Version: {meta.version}{" "}
              {lastUpdatedLabel ? `| Updated: ${lastUpdatedLabel}` : ""}
            </p>
          )}
          <p className="text-sm text-purple-400 mt-1.5">
            1 SC = 1 XP
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 [&>*]:flex-1 md:[&>*]:flex-none">
          {/* One guide for the whole screen, in place of the per-row info
              button each setting used to carry. */}
          <Button
            size="sm"
            variant="outline"
            className="border-[#2C323D] bg-[#242B35] text-gray-200 hover:bg-[#2C323D] hover:text-white"
            onClick={() => setGuideOpen(true)}
          >
            <BookOpen className="h-4 w-4 mr-1.5" />
            View Guide
          </Button>

          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => editorRef.current?.handleSave()}
            disabled={isSaving || isLoading}
          >
            <Save className="h-4 w-4 mr-1.5" />
            {isSaving ? "Saving..." : "Save All"}
          </Button>
        </div>
      </div>

      <div className="-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 scrollbar-hide md:-mx-4 md:mb-4 md:gap-3 md:px-4">
        {[
          { id: ALL_SECTIONS_TAB, title: "All" },
          ...SECTION_DEFINITIONS.map((section) => ({
            id: sectionId(section),
            title: section.title,
          })),
        ].map((tab) => {
          const active = tab.id === activeSection;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              aria-pressed={active}
              className={
                active
                  ? "shrink-0 whitespace-nowrap rounded-full border border-purple-500 bg-purple-600 px-3 py-1.5 text-sm font-medium text-white"
                  : "shrink-0 whitespace-nowrap rounded-full border border-[#2C323D] bg-[#191D24] px-3 py-1.5 text-sm text-gray-300 transition-colors hover:border-purple-500/60 hover:text-white"
              }
            >
              {tab.title}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 scrollbar-hide">
        {isLoading || !config ? (
          <div className="text-gray-300 text-sm">Loading system configuration...</div>
        ) : (
          <SystemConfigEditor
            key={`${meta?.version ?? "v0"}-${meta?.updatedAt ?? "u0"}`}
            ref={editorRef}
            initialConfig={config}
            isSaving={isSaving}
            saveConfig={saveConfig}
            activeSection={activeSection}
          />
        )}
      </div>

      <SettingsGuideDialog open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  );
}
