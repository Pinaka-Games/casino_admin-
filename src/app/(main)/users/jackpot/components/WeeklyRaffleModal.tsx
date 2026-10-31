"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "react-hot-toast";
import Image from "next/image";
import { coingreen, coingold } from "@/assets/icons";

import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  initialData?: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

interface FormType {
  email: string;
  username: string;
  totalTickets: number;
  activeTickets: number;
  pastTickets: number;
  winnings: number;
  prizeWin: number;
}

const defaultForm: FormType = {
  email: "",
  username: "",
  totalTickets: 0,
  activeTickets: 0,
  pastTickets: 0,
  winnings: 0,
  prizeWin: 0,
};

export default function WeeklyRaffleModal({
  open,
  initialData,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<FormType>(defaultForm);
  const [errors, setErrors] = useState<any>({});

  /* ================= LOAD EDIT DATA ================= */

  useEffect(() => {
    if (initialData) {
      setForm(initialData);
    } else {
      setForm(defaultForm);
    }
  }, [initialData, open]);

  /* ================= HANDLE CHANGE ================= */

  const handleChange = (key: keyof FormType, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /* ================= VALIDATION ================= */

  const validate = () => {
    const newErrors: any = {};

    if (!form.email.trim()) {
      newErrors.email = "Email is required";
      toast.error("Email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Invalid email format";
      toast.error("Invalid email format");
    }

    if (!form.username.trim()) {
      newErrors.username = "Username is required";
      toast.error("Username is required");
    }

    if (form.totalTickets < 0) {
      newErrors.totalTickets = "Invalid ticket count";
      toast.error("Total tickets cannot be negative");
    }

    if (form.activeTickets < 0) {
      newErrors.activeTickets = "Invalid active ticket";
      toast.error("Active tickets cannot be negative");
    }

    if (form.pastTickets < 0) {
      newErrors.pastTickets = "Invalid past ticket";
      toast.error("Past tickets cannot be negative");
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    onSubmit(form); // send form data to page.tsx
    toast.success(initialData ? "Jackpot updated" : "Jackpot created");
  };

  /* ================= INPUT STYLE ================= */

  const inputClass =
    "w-full bg-[#242B35] text-white text-sm rounded-md px-3 py-2 outline-none border-none focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-500";

  const labelClass = "text-xs text-gray-300 mb-1 block";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl bg-[#191D24] text-white border border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium">
            {initialData ? "Edit Jackpot" : "Create Jackpot"}
          </DialogTitle>
        </DialogHeader>

        {/* FORM GRID */}

        <div className="grid grid-cols-2 gap-4 mt-3">
          {/* EMAIL */}

          <div>
            <label className={labelClass}>Email *</label>
            <input
              className={inputClass}
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
            {errors.email && (
              <p className="text-red-400 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          {/* USERNAME */}

          <div>
            <label className={labelClass}>Username *</label>
            <input
              className={inputClass}
              value={form.username}
              onChange={(e) => handleChange("username", e.target.value)}
            />
            {errors.username && (
              <p className="text-red-400 text-xs mt-1">{errors.username}</p>
            )}
          </div>

          {/* TOTAL TICKETS */}

          <div>
            <label className={labelClass}>Total Tickets</label>
            <input
              type="number"
              className={inputClass}
              value={form.totalTickets}
              onChange={(e) =>
                handleChange("totalTickets", Number(e.target.value))
              }
            />
          </div>

          {/* ACTIVE TICKETS */}

          <div>
            <label className={labelClass}>Active Tickets</label>
            <input
              type="number"
              className={inputClass}
              value={form.activeTickets}
              onChange={(e) =>
                handleChange("activeTickets", Number(e.target.value))
              }
            />
          </div>

          {/* PAST TICKETS */}

          <div>
            <label className={labelClass}>Past Tickets</label>
            <input
              type="number"
              className={inputClass}
              value={form.pastTickets}
              onChange={(e) =>
                handleChange("pastTickets", Number(e.target.value))
              }
            />
          </div>

          {/* WINNINGS */}
          <div>
            <label className={labelClass}>Winnings</label>
            <div className="relative">
              <input
                type="number"
                className={inputClass + " pl-8"}
                value={form.winnings}
                onChange={(e) => handleChange("winnings", Number(e.target.value))}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Image src={coingreen} alt="coin" width={16} height={16} />
              </div>
            </div>
          </div>

          {/* PRIZE WIN */}
          <div>
            <label className={labelClass}>Prize Win ($)</label>
            <div className="relative">
              <input
                type="number"
                className={inputClass + " pl-8"}
                value={form.prizeWin}
                onChange={(e) => handleChange("prizeWin", Number(e.target.value))}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Image src={coingreen} alt="coin" width={16} height={16} />
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}

        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="ghost"
            onClick={onClose}
            className="bg-[#242B35] hover:bg-[#2f3744]"
          >
            Cancel
          </Button>

          <Button
            onClick={handleSubmit}
            className="bg-purple-500 hover:bg-purple-600"
          >
            {initialData ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
