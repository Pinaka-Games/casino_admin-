"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FAQ } from "@/types/faq";
import { Switch } from "@/components/ui/switch";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faq?: FAQ | null;
  onSubmit: (data: Partial<FAQ>) => void;
}

export function FaqDialog({ open, onOpenChange, faq, onSubmit }: Props) {
  const isEdit = !!faq;

  const [tab, setTab] = React.useState<"en" | "es">("en");

  const [questionEn, setQuestionEn] = React.useState("");
  const [answerEn, setAnswerEn] = React.useState("");
  const [questionEs, setQuestionEs] = React.useState("");
  const [answerEs, setAnswerEs] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);

  const [showError, setShowError] = React.useState(false);

  /* ================= LOAD DATA ================= */
  React.useEffect(() => {
    setShowError(false);

    if (faq) {
      setQuestionEn(faq.questionEn);
      setAnswerEn(faq.answerEn);
      setQuestionEs(faq.questionEs);
      setAnswerEs(faq.answerEs);
      setIsActive(faq.isActive);
    } else {
      setQuestionEn("");
      setAnswerEn("");
      setQuestionEs("");
      setAnswerEs("");
      setIsActive(true);
    }
  }, [faq, open]);

  /* ================= VALIDATION ================= */
  const isFormValid =
    questionEn.trim().length > 0 &&
    answerEn.trim().length > 0 &&
    questionEs.trim().length > 0 &&
    answerEs.trim().length > 0;

  /* ================= SUBMIT ================= */
  const handleSubmit = () => {
    if (!isFormValid) {
      setShowError(true);
      return;
    }

    setShowError(false);

    onSubmit({
      questionEn,
      answerEn,
      questionEs,
      answerEs,
      isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#101318] text-white max-w-lg">
        <DialogHeader>
          <h2 className="text-lg font-semibold">
            {isEdit ? "Edit FAQ" : "Create FAQ"}
          </h2>
        </DialogHeader>

        {/* LANGUAGE TABS */}
        <div className="flex gap-4 border-b border-gray-700 pb-2">
          <button
            onClick={() => setTab("en")}
            className={`text-sm pb-1 ${
              tab === "en"
                ? "border-b-2 border-purple-500 text-purple-400"
                : "text-gray-400"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setTab("es")}
            className={`text-sm pb-1 ${
              tab === "es"
                ? "border-b-2 border-purple-500 text-purple-400"
                : "text-gray-400"
            }`}
          >
            Spanish
          </button>
        </div>

        {/* FORM */}
        <div className="space-y-3 mt-3">
          {tab === "en" && (
            <>
              <Input
                placeholder="Question (English)"
                value={questionEn}
                onChange={(e) => setQuestionEn(e.target.value)}
              />
              <Input
                placeholder="Answer (English)"
                value={answerEn}
                onChange={(e) => setAnswerEn(e.target.value)}
              />
            </>
          )}

          {tab === "es" && (
            <>
              <Input
                placeholder="Question (Spanish)"
                value={questionEs}
                onChange={(e) => setQuestionEs(e.target.value)}
              />
              <Input
                placeholder="Answer (Spanish)"
                value={answerEs}
                onChange={(e) => setAnswerEs(e.target.value)}
              />
            </>
          )}
        </div>

        {/* FOOTER */}
        <DialogFooter className="mt-5 flex items-center gap-3">
          {showError && (
            <p className="text-sm text-red-500 mr-auto">
              Please fill all required fields before saving.
            </p>
          )}

          <Button
            className="bg-[#B93DEB] hover:bg-[#a632d1] text-white"
            onClick={handleSubmit}
          >
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
