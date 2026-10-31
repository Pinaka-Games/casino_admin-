"use client";

import * as React from "react";
import { useRef } from "react";
import Image from "next/image";

import {
  Sponsorship,
  ContentSection,
  ContentBlock,
} from "@/types/sponsorship";

import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import ImageUploader, {
  ImageUploaderRef,
} from "@/components/image-upload/ImageUploader";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: Sponsorship | null;
  onSubmit: (data: {
    sectionsEn: ContentSection[];
    sectionsEs: ContentSection[];
    imageUrl: string;
    imageKey: string;
    isActive: boolean;
  }) => void;
}

export function ContentDialog({
  open,
  onOpenChange,
  content,
  onSubmit,
}: Props) {
  const isEdit = Boolean(content);

  /* ================= STATE ================= */
  const [sectionsEn, setSectionsEn] = React.useState<ContentSection[]>([]);
  const [sectionsEs, setSectionsEs] = React.useState<ContentSection[]>([]);
  const [isActive, setIsActive] = React.useState(true);

  const [imageUrl, setImageUrl] = React.useState("");
  const [imageKey, setImageKey] = React.useState("");

  const [showError, setShowError] = React.useState(false);

  const uploaderRef = useRef<ImageUploaderRef>(null);

  /* ================= LOAD DATA ================= */
  React.useEffect(() => {
    setShowError(false);

    if (content) {
      setSectionsEn(content.sectionsEn || []);
      setSectionsEs(content.sectionsEs || []);
      setIsActive(content.isActive);
      setImageUrl(content.imageUrl);
      setImageKey(content.imageKey);
    } else {
      setSectionsEn([]);
      setSectionsEs([]);
      setIsActive(true);
      setImageUrl("");
      setImageKey("");
    }
  }, [content, open]);

  /* ================= HELPERS ================= */
  const addSection = (lang: "en" | "es") => {
    const section: ContentSection = { heading: "", blocks: [] };
    lang === "en"
      ? setSectionsEn((p) => [...p, section])
      : setSectionsEs((p) => [...p, section]);
  };

  const addBlock = (
    lang: "en" | "es",
    sectionIndex: number,
    block: ContentBlock
  ) => {
    const sections = lang === "en" ? [...sectionsEn] : [...sectionsEs];
    sections[sectionIndex].blocks.push(block);
    lang === "en" ? setSectionsEn(sections) : setSectionsEs(sections);
  };

  /* ================= VALIDATION ================= */
  const isValidSections = (sections: ContentSection[]) => {
    if (!sections.length) return false;

    return sections.every((section) => {
      if (!section.heading.trim()) return false;
      if (!section.blocks.length) return false;

      return section.blocks.every((block) => {
        if (block.type === "paragraph") {
          return block.content.trim().length > 0;
        }

        if (block.type === "numbered_list") {
          return (
            block.items.length > 0 &&
            block.items.every((item) => item.trim().length > 0)
          );
        }

        return false;
      });
    });
  };

  const isFormValid =
    imageUrl.trim() !== "" &&
    imageKey.trim() !== "" &&
    isValidSections(sectionsEn) &&
    isValidSections(sectionsEs);

  /* ================= SUBMIT ================= */
  const handleSave = () => {
    if (!isFormValid) {
      setShowError(true);
      return;
    }

    setShowError(false);

    onSubmit({
      sectionsEn,
      sectionsEs,
      imageUrl,
      imageKey,
      isActive,
    });
  };

  /* ================= RENDER SECTIONS ================= */
  const renderSections = (
    sections: ContentSection[],
    setSections: React.Dispatch<React.SetStateAction<ContentSection[]>>,
    lang: "en" | "es"
  ) =>
    sections.map((section, i) => (
      <div
        key={i}
        className="rounded-lg border border-white/10 bg-[#15181E] p-4 space-y-3"
      >
        {/* SECTION HEADING */}
        <div>
          <div className="flex items-center gap-1">
            <span className="text-sm text-gray-400">
              Section heading
            </span>
            {showError && !section.heading.trim() && (
              <span className="text-red-500">*</span>
            )}
          </div>

          <Input
            placeholder="Section heading"
            value={section.heading}
            onChange={(e) => {
              const updated = [...sections];
              updated[i].heading = e.target.value;
              setSections(updated);
            }}
          />
        </div>

        {/* BLOCKS */}
        {section.blocks.map((block, bIndex) => {
          if (block.type === "paragraph") {
            return (
              <div key={bIndex}>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-400">
                    Paragraph
                  </span>
                  {showError && !block.content.trim() && (
                    <span className="text-red-500">*</span>
                  )}
                </div>

                <Input
                  placeholder="Paragraph text"
                  value={block.content}
                  onChange={(e) => {
                    const updated = [...sections];
                    (updated[i].blocks[bIndex] as any).content =
                      e.target.value;
                    setSections(updated);
                  }}
                />
              </div>
            );
          }

          if (block.type === "numbered_list") {
            return (
              <div key={bIndex} className="space-y-2">
                {block.items.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-400">
                        List item {idx + 1}
                      </span>
                      {showError && !item.trim() && (
                        <span className="text-red-500">*</span>
                      )}
                    </div>

                    <Input
                      placeholder={`List item ${idx + 1}`}
                      value={item}
                      onChange={(e) => {
                        const updated = [...sections];
                        (updated[i].blocks[bIndex] as any).items[
                          idx
                        ] = e.target.value;
                        setSections(updated);
                      }}
                    />
                  </div>
                ))}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const updated = [...sections];
                    (updated[i].blocks[bIndex] as any).items.push(
                      ""
                    );
                    setSections(updated);
                  }}
                >
                  + Add item
                </Button>
              </div>
            );
          }

          return null;
        })}

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              addBlock(lang, i, { type: "paragraph", content: "" })
            }
          >
            + Paragraph
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              addBlock(lang, i, {
                type: "numbered_list",
                items: [""],
              })
            }
          >
            + List
          </Button>
        </div>
      </div>
    ));

  /* ================= UI ================= */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-w-5xl max-h-[90vh] bg-[#101318] text-white border border-white/10 p-0">
        <DialogHeader className="px-6 py-4 border-b border-white/10 text-lg font-semibold shrink-0">
          {isEdit ? "Edit Sponsorship" : "Create Sponsorship"}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide space-y-8">
          {/* IMAGE */}
          <div className="rounded-lg border border-white/10 bg-[#15181E] p-4">
            <p className="text-sm text-gray-400 mb-3">
              Main Image{" "}
              {showError && (!imageUrl || !imageKey) && (
                <span className="text-red-500">*</span>
              )}
            </p>

            <div className="flex items-center gap-4">
              {imageUrl && (
                <Image
                  src={imageUrl}
                  alt="preview"
                  width={140}
                  height={70}
                  className="rounded object-cover"
                  unoptimized
                />
              )}

              <Button
                variant="outline"
                onClick={() => uploaderRef.current?.open()}
              >
                Upload Image
              </Button>
            </div>
          </div>

          {/* ENGLISH */}
          <div>
            <h3 className="text-base font-medium mb-4">
              English Content
            </h3>
            <div className="space-y-4">
              {renderSections(sectionsEn, setSectionsEn, "en")}
              <Button variant="outline" onClick={() => addSection("en")}>
                + Add English Section
              </Button>
            </div>
          </div>

          {/* SPANISH */}
          <div>
            <h3 className="text-base font-medium mb-4">
              Spanish Content
            </h3>
            <div className="space-y-4">
              {renderSections(sectionsEs, setSectionsEs, "es")}
              <Button variant="outline" onClick={() => addSection("es")}>
                + Add Spanish Section
              </Button>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-white/10 shrink-0">
          {showError && (
            <p className="text-sm text-red-500 mr-auto">
              Please fill all required fields before saving.
            </p>
          )}

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>

          <Button
            className="bg-[#B93DEB] hover:bg-[#a632d1] text-white"
            onClick={handleSave}
          >
            Save
          </Button>
        </div>

        <ImageUploader
          ref={uploaderRef}
          folder="sponsorship"
          aspect={14 / 9}
          onUploadComplete={(url, key) => {
            setImageUrl(url);
            setImageKey(key);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}