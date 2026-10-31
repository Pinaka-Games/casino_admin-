"use client";

import * as React from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ImageUploader, {
  ImageUploaderRef,
} from "@/components/image-upload/ImageUploader";
import { useRef } from "react";
import { Banner, BannerActionType } from "@/types/banner";
import toast from "react-hot-toast";
import { Info } from "lucide-react";
import {
  DestinationOption,
  loadBannerDestinations,
} from "./banner-destinations";
import { BannerDestinationPicker } from "./banner-destination-picker";
import { BannerInfoDialog } from "./banner-info-dialog";

/** Small field wrapper: label above, hint + counter below. */
function Field({
  label,
  hint,
  error,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 flex items-center text-xs font-medium text-gray-300">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[10px] leading-snug text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

const CHAR_LIMIT = 50;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  banner?: Banner | null;
  onSubmit: (data: Partial<Banner>) => void;
}

export function BannerDialog({ open, onOpenChange, banner, onSubmit }: Props) {
  const isEdit = !!banner;
  const uploaderRef = useRef<ImageUploaderRef>(null);

  const [tab, setTab] = React.useState<"en" | "es">("en");

  /* COMMON */
  const [imageUrl, setImageUrl] = React.useState("");
  const [imageKey, setImageKey] = React.useState("");
  const [link, setLink] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState(1);
  const [isActive, setIsActive] = React.useState(true);

  // Every banner navigates. The other action types (auth modal, referral, app
  // download, claim bonus) were never used and each one needed its own payload,
  // so the picker was more room for error than a feature. Kept in state because
  // the API still stores the field.
  const [actionType, setActionType] =
    React.useState<BannerActionType>("NAVIGATE");

  const [actionPayload, setActionPayload] = React.useState<any>({});
  const [actionPayloadText, setActionPayloadText] = React.useState<string>("");
  const [referralCode, setReferralCode] = React.useState("");

  /* EN */
  const [titleEn, setTitleEn] = React.useState("");
  const [subtitleEn, setSubtitleEn] = React.useState("");
  const [oneLineEn, setOneLineEn] = React.useState("");
  const [amountEn, setAmountEn] = React.useState("");
  const [amountSuffixEn, setAmountSuffixEn] = React.useState("");
  const [buttonTextEn, setButtonTextEn] = React.useState("");

  /* ES */
  const [titleEs, setTitleEs] = React.useState("");
  const [subtitleEs, setSubtitleEs] = React.useState("");
  const [oneLineEs, setOneLineEs] = React.useState("");
  const [amountEs, setAmountEs] = React.useState("");
  const [amountSuffixEs, setAmountSuffixEs] = React.useState("");
  const [buttonTextEs, setButtonTextEs] = React.useState("");

  /* ERRORS */
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  /* DESTINATIONS — live player menu + profile tabs, loaded once per open */
  const [destinations, setDestinations] = React.useState<DestinationOption[]>([]);
  const [useCustomLink, setUseCustomLink] = React.useState(false);
  const [infoOpen, setInfoOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    loadBannerDestinations().then((options) => {
      if (alive) setDestinations(options);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  // A saved link that is not in the menu list is a hand-written one — reopen the
  // form in custom mode so the operator sees their value instead of a blank select.
  React.useEffect(() => {
    if (!open) return;
    if (!link) {
      setUseCustomLink(false);
      return;
    }
    setUseCustomLink(!destinations.some((d) => d.value === link));
  }, [open, link, destinations]);


  /* ---------------- HELPERS ---------------- */

  const clearError = (key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const resetForm = () => {
    setImageUrl("");
    setImageKey("");
    setLink("");
    setSortOrder(1);
    setIsActive(true);
    setActionType("NAVIGATE");
    setActionPayload({});
    setActionPayloadText("");
    setReferralCode("");

    setTitleEn("");
    setSubtitleEn("");
    setOneLineEn("");
    setAmountEn("");
    setAmountSuffixEn("");
    setButtonTextEn("");

    setTitleEs("");
    setSubtitleEs("");
    setOneLineEs("");
    setAmountEs("");
    setAmountSuffixEs("");
    setButtonTextEs("");

    setErrors({});
    setTab("en");
  };

  const fillFormFromBanner = (value: Banner) => {
    setImageUrl(value.imageUrl ?? "");
    setImageKey(value.imageKey ?? "");
    setLink(value.link ?? "");
    setSortOrder(value.sortOrder ?? 1);
    setIsActive(value.isActive ?? true);
    setActionType(value.actionType ?? "NAVIGATE");

    const payload = value.actionPayload ?? {};
    const hasPayload =
      payload !== null &&
      payload !== undefined &&
      (!(typeof payload === "object") || Object.keys(payload).length > 0);
    setActionPayload(payload);
    setActionPayloadText(hasPayload ? JSON.stringify(payload) : "");
    setReferralCode(
      typeof (payload as any)?.referralCode === "string"
        ? (payload as any).referralCode
        : typeof (payload as any)?.code === "string"
          ? (payload as any).code
          : "",
    );

    setTitleEn(value.titleEn ?? "");
    setSubtitleEn(value.subtitleEn ?? "");
    setOneLineEn(value.oneLineEn ?? "");
    setAmountEn(value.amountEn ?? "");
    setAmountSuffixEn(value.amountSuffixEn ?? "");
    setButtonTextEn(value.buttonTextEn ?? "");

    setTitleEs(value.titleEs ?? "");
    setSubtitleEs(value.subtitleEs ?? "");
    setOneLineEs(value.oneLineEs ?? "");
    setAmountEs(value.amountEs ?? "");
    setAmountSuffixEs(value.amountSuffixEs ?? "");
    setButtonTextEs(value.buttonTextEs ?? "");

    setErrors({});
    setTab("en");
  };

  /* ---------------- EFFECT ---------------- */

  React.useEffect(() => {
    if (!open) return;

    if (banner) {
      fillFormFromBanner(banner);
      return;
    }

    resetForm();
  }, [open, banner]);

  React.useEffect(() => {
    const updatedErrors = { ...errors };

    if (imageUrl && updatedErrors.imageUrl) {
      delete updatedErrors.imageUrl;
    }

    if ((titleEn.trim() || titleEs.trim()) && updatedErrors.title) {
      delete updatedErrors.title;
    }

    if (sortOrder >= 1 && updatedErrors.sortOrder) {
      delete updatedErrors.sortOrder;
    }

    if (actionPayloadText) {
      try {
        JSON.parse(actionPayloadText);
        if (updatedErrors.actionPayload) {
          delete updatedErrors.actionPayload;
        }
      } catch {
        // do nothing, keep error
      }
    } else {
      if (updatedErrors.actionPayload) {
        delete updatedErrors.actionPayload;
      }
    }

    if (titleEn.length > CHAR_LIMIT) {
      updatedErrors.titleEn = `Title cannot exceed ${CHAR_LIMIT} characters`;
    } else if (updatedErrors.titleEn) {
      delete updatedErrors.titleEn;
    }

    if (titleEs.length > CHAR_LIMIT) {
      updatedErrors.titleEs = `Título no puede superar los ${CHAR_LIMIT} caracteres`;
    } else if (updatedErrors.titleEs) {
      delete updatedErrors.titleEs;
    }

    if (subtitleEn.length > CHAR_LIMIT) {
      updatedErrors.subtitleEn = `Subtitle cannot exceed ${CHAR_LIMIT} characters`;
    } else if (updatedErrors.subtitleEn) {
      delete updatedErrors.subtitleEn;
    }

    if (subtitleEs.length > CHAR_LIMIT) {
      updatedErrors.subtitleEs = `Subtítulo no puede superar los ${CHAR_LIMIT} caracteres`;
    } else if (updatedErrors.subtitleEs) {
      delete updatedErrors.subtitleEs;
    }

    if (oneLineEn.length > CHAR_LIMIT) {
      updatedErrors.oneLineEn = `One Line Text cannot exceed ${CHAR_LIMIT} characters`;
    } else if (updatedErrors.oneLineEn) {
      delete updatedErrors.oneLineEn;
    }

    if (oneLineEs.length > CHAR_LIMIT) {
      updatedErrors.oneLineEs = `Texto corto no puede superar los ${CHAR_LIMIT} caracteres`;
    } else if (updatedErrors.oneLineEs) {
      delete updatedErrors.oneLineEs;
    }

    if (JSON.stringify(updatedErrors) !== JSON.stringify(errors)) {
      setErrors(updatedErrors);
    }
  }, [
    imageUrl,
    titleEn,
    titleEs,
    subtitleEn,
    subtitleEs,
    oneLineEn,
    oneLineEs,
    sortOrder,
    actionPayloadText,
  ]);

/* ---------------- PREFILL EDIT DATA ---------------- */

React.useEffect(() => {
  if (!banner) {
    resetForm();
    return;
  }

  // COMMON
  setImageUrl(banner.imageUrl || "");
  setImageKey(banner.imageKey || "");
  setLink(banner.link || "");
  setSortOrder(banner.sortOrder || 1);
  setIsActive(banner.isActive ?? true);

  setActionType(banner.actionType || "NAVIGATE");

  setActionPayload(banner.actionPayload || {});
  setActionPayloadText(
    banner.actionPayload
      ? JSON.stringify(banner.actionPayload, null, 2)
      : ""
  );

  // ENGLISH
  setTitleEn(banner.titleEn || "");
  setSubtitleEn(banner.subtitleEn || "");
  setOneLineEn(banner.oneLineEn || "");
  setAmountEn(banner.amountEn || "");
  setAmountSuffixEn(banner.amountSuffixEn || "");
  setButtonTextEn(banner.buttonTextEn || "");

  // SPANISH
  setTitleEs(banner.titleEs || "");
  setSubtitleEs(banner.subtitleEs || "");
  setOneLineEs(banner.oneLineEs || "");
  setAmountEs(banner.amountEs || "");
  setAmountSuffixEs(banner.amountSuffixEs || "");
  setButtonTextEs(banner.buttonTextEs || "");
}, [banner]);

  /* ---------------- VALIDATION ---------------- */

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!imageUrl) {
      newErrors.imageUrl = "Banner image is required";
    }

    if (!titleEn.trim()) newErrors.titleEn = "Title (English) is required";
    if (!titleEs.trim()) newErrors.titleEs = "Título (Spanish) is required";
    if (!subtitleEn.trim()) newErrors.subtitleEn = "Subtitle (English) is required";
    if (!subtitleEs.trim()) newErrors.subtitleEs = "Subtítulo (Spanish) is required";
    if (!oneLineEn.trim()) newErrors.oneLineEn = "One line text (English) is required";
    if (!oneLineEs.trim()) newErrors.oneLineEs = "Texto corto (Spanish) is required";
    if (!amountEn.trim()) newErrors.amountEn = "Amount (English) is required";
    if (!amountEs.trim()) newErrors.amountEs = "Cantidad (Spanish) is required";
    if (!amountSuffixEn.trim()) newErrors.amountSuffixEn = "Amount suffix (English) is required";
    if (!amountSuffixEs.trim()) newErrors.amountSuffixEs = "Sufijo (Spanish) is required";
    if (!buttonTextEn.trim()) newErrors.buttonTextEn = "Button text (English) is required";
    if (!buttonTextEs.trim()) newErrors.buttonTextEs = "Texto del botón (Spanish) is required";

    if (actionType === "NAVIGATE" && !link.trim()) {
      newErrors.link = "Destination link is required";
    }

    if (actionType === "OPEN_REFERRAL_SIGNUP" && !referralCode.trim()) {
      newErrors.referralCode = "Referral code is required";
    }

    if (!sortOrder || sortOrder < 1) {
      newErrors.sortOrder = "Sort order must be 1 or greater";
    }

    if (actionPayloadText) {
      try {
        JSON.parse(actionPayloadText);
      } catch {
        newErrors.actionPayload = "Invalid JSON payload";
      }
    }

    if (titleEn.length > CHAR_LIMIT) {
      newErrors.titleEn = `Title cannot exceed ${CHAR_LIMIT} characters`;
    }
    if (titleEs.length > CHAR_LIMIT) {
      newErrors.titleEs = `Título no puede superar los ${CHAR_LIMIT} caracteres`;
    }
    if (subtitleEn.length > CHAR_LIMIT) {
      newErrors.subtitleEn = `Subtitle cannot exceed ${CHAR_LIMIT} characters`;
    }
    if (subtitleEs.length > CHAR_LIMIT) {
      newErrors.subtitleEs = `Subtítulo no puede superar los ${CHAR_LIMIT} caracteres`;
    }
    if (oneLineEn.length > CHAR_LIMIT) {
      newErrors.oneLineEn = `One Line Text cannot exceed ${CHAR_LIMIT} characters`;
    }
    if (oneLineEs.length > CHAR_LIMIT) {
      newErrors.oneLineEs = `Texto corto no puede superar los ${CHAR_LIMIT} caracteres`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) {
      toast.error("Please fill all required fields, including the Spanish section");
      return;
    }

    onSubmit({
      imageUrl,
      imageKey,
      link,
      sortOrder,
      isActive,
      actionType,
      actionPayload,

      titleEn,
      subtitleEn,
      oneLineEn,
      amountEn,
      amountSuffixEn,
      buttonTextEn,

      titleEs,
      subtitleEs,
      oneLineEs,
      amountEs,
      amountSuffixEs,
      buttonTextEs,
    });
  };

  /* ---------------- UI ---------------- */

  return (
    <Dialog
  open={open}
  onOpenChange={(val) => {
    onOpenChange(val);
    if (!val) resetForm();
  }}
>
      <DialogContent className="bg-[#101318] text-white w-[92vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <h2 className="text-lg font-semibold">
              {isEdit ? "Edit Banner" : "Create Banner"}
            </h2>

            {/* Field reference — which input lands where on the player banner */}
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              title="What does each field do?"
              className="flex items-center gap-1.5 rounded-md border border-gray-700 bg-[#191D24] px-2.5 py-1 text-[11px] text-gray-300 transition-colors hover:border-purple-500/60 hover:text-purple-300"
            >
              <Info size={13} />
              Field guide
            </button>
          </div>
        </DialogHeader>

        {/* IMAGE + LANGUAGE TABS — one row; both are short controls and the
            dialog is wide enough that stacking them only cost height. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {imageUrl && (
              <Image
                src={imageUrl}
                alt="preview"
                width={112}
                height={56}
                className="rounded border border-gray-800"
                unoptimized
              />
            )}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => uploaderRef.current?.open()}
              >
                {imageUrl ? "Replace image" : "Upload WebP image"}
              </Button>
              <p className="mt-1 text-[10px] text-gray-500">
                WebP only · max 1 MB · 17:10 · art sits on the right of the banner
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={tab === "en" ? "default" : "outline"}
              className={tab === "en" ? "bg-[#B93DEB] hover:bg-[#A32ED4]" : ""}
              onClick={() => setTab("en")}
            >
              English
            </Button>
            <Button
              size="sm"
              variant={tab === "es" ? "default" : "outline"}
              className={tab === "es" ? "bg-[#B93DEB] hover:bg-[#A32ED4]" : ""}
              onClick={() => setTab("es")}
            >
              Spanish
            </Button>
          </div>
        </div>
        {errors.imageUrl && (
          <p className="text-red-400 text-xs">{errors.imageUrl}</p>
        )}

        {/* EN */}
        {tab === "en" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
            <div>
              <label className="mb-1 flex items-center text-xs font-medium text-gray-300">Title<span className="ml-1 text-red-500">*</span></label>
              <Input
                placeholder="e.g. Stay Untamed"
                value={titleEn}
                maxLength={CHAR_LIMIT}
                onChange={(e) => {
                  setTitleEn(e.target.value);
                  clearError("titleEn");
                }}
                className={titleEn.length >= CHAR_LIMIT ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              <div className="flex justify-between items-center mt-1">
                {errors.titleEn ? (
                  <p className="text-red-400 text-xs">{errors.titleEn}</p>
                ) : (
                  <div />
                )}
                <span className={`text-[10px] ${titleEn.length >= CHAR_LIMIT ? "text-red-400 font-medium" : "text-gray-400"}`}>
                  {titleEn.length}/{CHAR_LIMIT}
                </span>
              </div>
            </div>
            <div>
              <label className="mb-1 flex items-center text-xs font-medium text-gray-300">Subtitle<span className="ml-1 text-red-500">*</span></label>
              <Input
                placeholder="e.g. Sign Up & Get Up to"
                value={subtitleEn}
                maxLength={CHAR_LIMIT}
                onChange={(e) => {
                  setSubtitleEn(e.target.value);
                  clearError("subtitleEn");
                }}
                className={subtitleEn.length >= CHAR_LIMIT ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              <div className="flex justify-between items-center mt-1">
                {errors.subtitleEn ? (
                  <p className="text-red-400 text-xs">{errors.subtitleEn}</p>
                ) : (
                  <div />
                )}
                <span className={`text-[10px] ${subtitleEn.length >= CHAR_LIMIT ? "text-red-400 font-medium" : "text-gray-400"}`}>
                  {subtitleEn.length}/{CHAR_LIMIT}
                </span>
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 flex items-center text-xs font-medium text-gray-300">One line text<span className="ml-1 text-red-500">*</span></label>
              <Input
                placeholder="e.g. Thousands of games"
                value={oneLineEn}
                maxLength={CHAR_LIMIT}
                onChange={(e) => {
                  setOneLineEn(e.target.value);
                  clearError("oneLineEn");
                }}
                className={oneLineEn.length >= CHAR_LIMIT ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              <div className="flex justify-between items-center mt-1">
                {errors.oneLineEn ? (
                  <p className="text-red-400 text-xs">{errors.oneLineEn}</p>
                ) : (
                  <div />
                )}
                <span className={`text-[10px] ${oneLineEn.length >= CHAR_LIMIT ? "text-red-400 font-medium" : "text-gray-400"}`}>
                  {oneLineEn.length}/{CHAR_LIMIT}
                </span>
              </div>
            </div>
            <Field label="Amount" hint="The figure, shown in purple." error={errors.amountEn} required={true}>
              <Input
                placeholder="e.g. 20,000.00"
                value={amountEn}
                onChange={(e) => {
                  setAmountEn(e.target.value);
                  clearError("amountEn");
                }}
              />
            </Field>
            <Field label="Amount suffix" hint="Words after the amount." error={errors.amountSuffixEn} required={true}>
              <Input
                placeholder="e.g. in Casino"
                value={amountSuffixEn}
                onChange={(e) => {
                  setAmountSuffixEn(e.target.value);
                  clearError("amountSuffixEn");
                }}
              />
            </Field>
            <Field
              label="Display order"
              hint="Lower shows first in the rotating carousel."
              error={errors.sortOrder}
              required={true}
            >
              <Input
                type="number"
                min={1}
                placeholder="e.g. 1"
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(Number(e.target.value));
                  clearError("sortOrder");
                }}
              />
            </Field>
            <Field label="Button text" hint="Two or three words." required={true}>
              <Input
                placeholder="e.g. Claim Now"
                value={buttonTextEn}
                maxLength={CHAR_LIMIT}
                onChange={(e) => {
                  setButtonTextEn(e.target.value);
                  clearError("buttonTextEn");
                }}
                className={buttonTextEn.length >= CHAR_LIMIT ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              <div className="mt-1 flex justify-between items-center">
                {errors.buttonTextEn ? (
                  <p className="text-red-400 text-xs">{errors.buttonTextEn}</p>
                ) : (
                  <div />
                )}
                <span
                  className={`text-[10px] ${buttonTextEn.length >= CHAR_LIMIT ? "text-red-400 font-medium" : "text-gray-400"}`}
                >
                  {buttonTextEn.length}/{CHAR_LIMIT}
                </span>
              </div>
            </Field>
            <Field
              label="Button action"
              hint="What tapping the button does."
              required={true}
            >
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as BannerActionType)}
                className="h-9 w-full rounded-md border border-gray-700 bg-[#191d24] px-2 text-sm"
              >
                <option value="NAVIGATE">Go to a page</option>
                <option value="OPEN_SIGNUP_MODAL">Open sign-up</option>
                <option value="OPEN_AUTH_MODAL">Open login</option>
                <option value="OPEN_REFERRAL_SIGNUP">Sign-up with referral code</option>
                <option value="OPEN_DAILY_STREAK_MODAL">Open daily streak</option>
                <option value="OPEN_BUNDLE_SALE_MODAL">Open bundle sale</option>
                <option value="OPEN_MESSAGE_MODAL">Open message popup</option>
              </select>
            </Field>
          </div>
        )}

        {/* ES */}
        {tab === "es" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
            <div>
              <label className="mb-1 flex items-center text-xs font-medium text-gray-300">Título<span className="ml-1 text-red-500">*</span></label>
              <Input
                placeholder="ej. Mantente Salvaje"
                value={titleEs}
                maxLength={CHAR_LIMIT}
                onChange={(e) => {
                  setTitleEs(e.target.value);
                  clearError("titleEs");
                }}
                className={titleEs.length >= CHAR_LIMIT ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              <div className="flex justify-between items-center mt-1">
                {errors.titleEs ? (
                  <p className="text-red-400 text-xs">{errors.titleEs}</p>
                ) : (
                  <div />
                )}
                <span className={`text-[10px] ${titleEs.length >= CHAR_LIMIT ? "text-red-400 font-medium" : "text-gray-400"}`}>
                  {titleEs.length}/{CHAR_LIMIT}
                </span>
              </div>
            </div>
            <div>
              <label className="mb-1 flex items-center text-xs font-medium text-gray-300">Subtítulo<span className="ml-1 text-red-500">*</span></label>
              <Input
                placeholder="ej. Regístrate y Recibe"
                value={subtitleEs}
                maxLength={CHAR_LIMIT}
                onChange={(e) => {
                  setSubtitleEs(e.target.value);
                  clearError("subtitleEs");
                }}
                className={subtitleEs.length >= CHAR_LIMIT ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              <div className="flex justify-between items-center mt-1">
                {errors.subtitleEs ? (
                  <p className="text-red-400 text-xs">{errors.subtitleEs}</p>
                ) : (
                  <div />
                )}
                <span className={`text-[10px] ${subtitleEs.length >= CHAR_LIMIT ? "text-red-400 font-medium" : "text-gray-400"}`}>
                  {subtitleEs.length}/{CHAR_LIMIT}
                </span>
              </div>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 flex items-center text-xs font-medium text-gray-300">Texto corto<span className="ml-1 text-red-500">*</span></label>
              <Input
                placeholder="ej. Miles de juegos"
                value={oneLineEs}
                maxLength={CHAR_LIMIT}
                onChange={(e) => {
                  setOneLineEs(e.target.value);
                  clearError("oneLineEs");
                }}
                className={oneLineEs.length >= CHAR_LIMIT ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              <div className="flex justify-between items-center mt-1">
                {errors.oneLineEs ? (
                  <p className="text-red-400 text-xs">{errors.oneLineEs}</p>
                ) : (
                  <div />
                )}
                <span className={`text-[10px] ${oneLineEs.length >= CHAR_LIMIT ? "text-red-400 font-medium" : "text-gray-400"}`}>
                  {oneLineEs.length}/{CHAR_LIMIT}
                </span>
              </div>
            </div>
            <Field label="Cantidad" hint="La cifra, en morado." error={errors.amountEs} required={true}>
              <Input
                placeholder="ej. 20,000.00"
                value={amountEs}
                onChange={(e) => {
                  setAmountEs(e.target.value);
                  clearError("amountEs");
                }}
              />
            </Field>
            <Field label="Sufijo" hint="Palabras después de la cifra." error={errors.amountSuffixEs} required={true}>
              <Input
                placeholder="ej. en Casino"
                value={amountSuffixEs}
                onChange={(e) => {
                  setAmountSuffixEs(e.target.value);
                  clearError("amountSuffixEs");
                }}
              />
            </Field>
            <Field
              label="Display order"
              hint="Lower shows first in the rotating carousel."
              error={errors.sortOrder}
              required={true}
            >
              <Input
                type="number"
                min={1}
                placeholder="e.g. 1"
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(Number(e.target.value));
                  clearError("sortOrder");
                }}
              />
            </Field>
            <Field label="Texto del botón" hint="Dos o tres palabras." required={true}>
              <Input
                placeholder="ej. Reclamar Ahora"
                value={buttonTextEs}
                maxLength={CHAR_LIMIT}
                onChange={(e) => {
                  setButtonTextEs(e.target.value);
                  clearError("buttonTextEs");
                }}
                className={buttonTextEs.length >= CHAR_LIMIT ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              <div className="mt-1 flex justify-between items-center">
                {errors.buttonTextEs ? (
                  <p className="text-red-400 text-xs">{errors.buttonTextEs}</p>
                ) : (
                  <div />
                )}
                <span
                  className={`text-[10px] ${buttonTextEs.length >= CHAR_LIMIT ? "text-red-400 font-medium" : "text-gray-400"}`}
                >
                  {buttonTextEs.length}/{CHAR_LIMIT}
                </span>
              </div>
            </Field>
            <Field
              label="Button action"
              hint="What tapping the button does."
              required={true}
            >
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as BannerActionType)}
                className="h-9 w-full rounded-md border border-gray-700 bg-[#191d24] px-2 text-sm"
              >
                <option value="NAVIGATE">Go to a page</option>
                <option value="OPEN_SIGNUP_MODAL">Open sign-up</option>
                <option value="OPEN_AUTH_MODAL">Open login</option>
                <option value="OPEN_REFERRAL_SIGNUP">Sign-up with referral code</option>
                <option value="OPEN_DAILY_STREAK_MODAL">Open daily streak</option>
                <option value="OPEN_BUNDLE_SALE_MODAL">Open bundle sale</option>
                <option value="OPEN_MESSAGE_MODAL">Open message popup</option>
              </select>
            </Field>
          </div>
        )}

        {/* REFERRAL CODE — only for the referral sign-up action. Stored on
            actionPayload, which is where the player app reads it from to
            prefill the sign-up form. */}
        {actionType === "OPEN_REFERRAL_SIGNUP" && (
          <Field
            label="Referral code"
            hint="Prefilled into the sign-up form when the player taps the button."
            error={errors.referralCode}
            required={true}
          >
            <Input
              placeholder="e.g. WULF500"
              value={referralCode}
              onChange={(e) => {
                const next = e.target.value.trim();
                setReferralCode(next);
                clearError("referralCode");
                setActionPayload(next ? { referralCode: next } : {});
                setActionPayloadText(
                  next ? JSON.stringify({ referralCode: next }) : "",
                );
              }}
            />
          </Field>
        )}

        {/* DESTINATION — only for NAVIGATE. The modal actions ignore the link,
            so offering a page picker for them would just be dead config. */}
        {actionType === "NAVIGATE" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Destination"
              hint="Pages come from Home & Menus plus the profile tabs."
              className={useCustomLink ? "" : "sm:col-span-2"}
              error={useCustomLink ? undefined : errors.link}
              required={!useCustomLink}
            >
              <BannerDestinationPicker
                value={link}
                options={destinations}
                isCustom={useCustomLink}
                onSelect={(next) => {
                  setUseCustomLink(false);
                  setLink(next);
                  clearError("link");
                }}
                onCustom={() => {
                  setUseCustomLink(true);
                  setLink("");
                  clearError("link");
                }}
              />
            </Field>

            {useCustomLink && (
              <Field
                label="Custom link"
                hint="Path like /en/promotions, or a full https:// URL."
                error={errors.link}
                required={true}
              >
                <Input
                  placeholder="/en/promotions"
                  value={link}
                  onChange={(e) => {
                    setLink(e.target.value);
                    clearError("link");
                  }}
                />
            </Field>
          )}
        </div>
        )}

        {errors.actionPayload && (
          <p className="text-red-400 text-xs">{errors.actionPayload}</p>
        )}

        {/* ACTIVE */}
        <label className="flex items-center justify-between bg-[#191d24] px-3 py-2 rounded-lg cursor-pointer">
          <span className="text-sm text-gray-300">Active</span>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
        </label>

        <DialogFooter>
          <Button className="bg-[#B93DEB] w-full" onClick={handleSubmit}>
            {isEdit ? "Update Banner" : "Create Banner"}
          </Button>
        </DialogFooter>

        <BannerInfoDialog open={infoOpen} onOpenChange={setInfoOpen} />

        {/* Matches the panel this art is actually rendered in.
            On a CONTENT banner the user app draws the copy on the left and
            this image on the right at w-55% of a 5/1.3 hero, i.e. a constant
            0.55 x (5/1.3) = 2.115 from xl up. The cropper used to enforce
            17/10 = 1.70, so every banner was authored at one ratio and
            displayed at another — the app stretched it to fit and the artwork
            rendered 25% too wide.

            The app now covers rather than stretches, so a mismatch costs a
            crop instead of distortion; cropping here at the display ratio
            means it costs nothing at all. Banners uploaded at 17:10 before
            this still work — re-crop them to recover their edges. */}
        <ImageUploader
          ref={uploaderRef}
          aspect={0.55 * (5 / 1.3)}
          folder="banners"
          onlyPNG
          onUploadComplete={(url, key) => {
            if (!url.toLowerCase().endsWith(".webp")) {
              toast.error("Only WebP images are allowed");
              return;
            }

            setImageUrl(url);
            setImageKey(key);
            clearError("imageUrl");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
