"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import ImageUploader, { ImageUploaderRef } from "@/components/image-upload/ImageUploader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "react-hot-toast";
import {
  createSidebarGroup,
  updateSidebarGroup,
  createSidebarItem,
  updateSidebarItem,
  SIDEBAR_ICON_KEYS,
  SIDEBAR_ACTIONS,
  type SidebarMenuGroup,
  type SidebarMenuItem,
} from "@/api/sidebar/sidebar";

type Mode = "group" | "item";

interface Props {
  open: boolean;
  mode: Mode;
  /** Target group id when creating a new item */
  groupId?: string;
  /** Editing an existing group */
  group?: SidebarMenuGroup | null;
  /** Editing an existing item */
  item?: SidebarMenuItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const NONE = "__none__";

export default function MenuFormModal({ open, mode, groupId, group, item, onClose, onSaved }: Props) {
  const editing = mode === "group" ? !!group : !!item;
  const i18nKey = mode === "group" ? group?.titleKey : item?.labelKey;

  const [text, setText] = useState("");
  const [iconKey, setIconKey] = useState<string>(NONE);
  const [iconUrl, setIconUrl] = useState("");
  const [link, setLink] = useState("");
  const uploaderRef = useRef<ImageUploaderRef>(null);
  const [enabled, setEnabled] = useState(true);
  // item-only
  const [action, setAction] = useState<string>(NONE);
  const [requireAuth, setRequireAuth] = useState(false);
  const [featureFlag, setFeatureFlag] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "group") {
      setText(group?.title ?? "");
      setIconKey(group?.iconKey ?? NONE);
      setIconUrl(group?.iconUrl ?? "");
      setLink(group?.link ?? "");
      setEnabled(group?.enabled ?? true);
    } else {
      setText(item?.label ?? "");
      setIconKey(item?.iconKey ?? NONE);
      setIconUrl(item?.iconUrl ?? "");
      setLink(item?.link ?? "");
      setEnabled(item?.enabled ?? true);
      setAction(item?.action ?? NONE);
      setRequireAuth(item?.requireAuth ?? false);
      setFeatureFlag(item?.featureFlag ?? "");
    }
  }, [open, mode, group, item]);

  const handleSubmit = async () => {
    // A brand-new entry needs a label (existing rows may keep their i18n key).
    if (!editing && !text.trim()) {
      toast.error(mode === "group" ? "Enter a section title" : "Enter an item label");
      return;
    }
    setSaving(true);
    try {
      const icon = iconKey === NONE ? "" : iconKey;
      if (mode === "group") {
        const payload = { title: text.trim(), iconKey: icon, iconUrl, link: link.trim(), enabled };
        if (group) await updateSidebarGroup(group.id, payload);
        else await createSidebarGroup(payload);
        toast.success(group ? "Section updated" : "Section created");
      } else {
        const payload = {
          label: text.trim(),
          iconKey: icon,
          iconUrl,
          link: link.trim(),
          action: action === NONE ? "" : action,
          requireAuth,
          featureFlag: featureFlag.trim(),
          enabled,
        };
        if (item) await updateSidebarItem(item.id, payload);
        else await createSidebarItem({ groupId, ...payload });
        toast.success(item ? "Item updated" : "Item created");
      }
      onSaved();
      onClose();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a2030] text-white border-gray-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit" : "Create"} {mode === "group" ? "Section" : "Menu Item"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>{mode === "group" ? "Section title" : "Item label"}</Label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={i18nKey ? `Translated as “${i18nKey}” — leave blank to keep it` : "e.g. Weekend Specials"}
              className="bg-[#15181E] border-gray-600 text-white"
            />
            {i18nKey && (
              <p className="text-[11px] text-gray-500">
                Leave blank to keep the built-in translated label.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Icon</Label>
            <Select value={iconKey} onValueChange={setIconKey} disabled={!!iconUrl}>
              <SelectTrigger className="bg-[#15181E] border-gray-600 text-white disabled:opacity-50">
                <SelectValue placeholder="Select an icon" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white border-gray-700 max-h-60">
                <SelectItem value={NONE}>No icon</SelectItem>
                {SIDEBAR_ICON_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Custom uploaded icon (overrides the preset). Square, rendered small
                in the sidebar so any upload size keeps the layout intact. */}
            <div className="flex items-center gap-2">
              {iconUrl ? (
                <div className="flex items-center gap-2 rounded-md border border-gray-700 bg-[#15181E] px-2 py-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={iconUrl} alt="icon" className="h-6 w-6 rounded object-contain" />
                  <span className="text-[11px] text-gray-400">Custom icon</span>
                  <button
                    type="button"
                    onClick={() => setIconUrl("")}
                    className="text-gray-400 hover:text-red-400"
                    title="Remove custom icon"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => uploaderRef.current?.open()}
                  className="flex items-center gap-1.5 rounded-md border border-gray-700 bg-[#15181E] px-3 py-1.5 text-[12px] text-gray-300 transition-colors hover:border-[#B93DEB] hover:text-[#B93DEB]"
                >
                  <Upload size={13} /> Upload custom icon
                </button>
              )}
            </div>
            {iconUrl && (
              <p className="text-[11px] text-gray-500">A custom icon overrides the preset above.</p>
            )}
            <ImageUploader
              ref={uploaderRef}
              aspect={1}
              folder="sidebar-icons"
              onlyPNG
              allowSvg
              onUploadComplete={(url) => setIconUrl(url)}
            />
          </div>

          <div className="grid gap-2">
            <Label>{mode === "group" ? "Header link (optional)" : "Link"}</Label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="e.g. /slots"
              className="bg-[#15181E] border-gray-600 text-white"
            />
          </div>

          {mode === "item" && (
            <>
              <div className="grid gap-2">
                <Label>Action (instead of navigating)</Label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger className="bg-[#15181E] border-gray-600 text-white">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                    <SelectItem value={NONE}>None (navigate to link)</SelectItem>
                    {SIDEBAR_ACTIONS.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Feature flag (optional)</Label>
                <Input
                  value={featureFlag}
                  onChange={(e) => setFeatureFlag(e.target.value)}
                  placeholder="e.g. vip_tier_enabled"
                  className="bg-[#15181E] border-gray-600 text-white"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-[#15181E] px-3 py-2">
                <span className="text-sm text-gray-300">Only for logged-in players</span>
                <Switch
                  checked={requireAuth}
                  onCheckedChange={setRequireAuth}
                  className="data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-[#15181E] px-3 py-2">
            <span className="text-sm text-gray-300">Visible</span>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              className="data-[state=checked]:bg-[#B93DEB] data-[state=unchecked]:bg-gray-700"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-[#B93DEB] hover:bg-[#a32cd4]">
            {saving ? "Saving…" : editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
