"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: any | null;
  onSubmit: (data: any) => void;
}

const EMPTY_FORM = {
  minActivePlayer: "",
  winLoseFrom: "",
  winLoseTo: "",
  sharingPercentage: "",
  report: "yes",
};

export function RevenueSharingDialog({
  open,
  onOpenChange,
  data,
  onSubmit,
}: Props) {
  const isEdit = Boolean(data);
  const [formData, setFormData] = useState<any>(EMPTY_FORM);

  useEffect(() => {
    if (data) {
      setFormData({
        ...data,
        report: data.isActive ? "yes" : "no",
      });
    } else {
      setFormData(EMPTY_FORM);
    }
  }, [data, open]);

  const handleSubmit = () => {
    onSubmit({
      ...formData,
      isActive: formData.report === "yes",
      ...(isEdit && { id: data.id }),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#15181E] text-white max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit" : "Create New"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {[
            ["Min Active Player", "minActivePlayer"],
            ["Win Lose From", "winLoseFrom"],
            ["Win Lose To", "winLoseTo"],
            ["Sharing Percentage", "sharingPercentage"],
          ].map(([label, key]) => (
            <div key={key}>
              <Label className="text-xs text-white">{label}</Label>
              <Input
                value={formData[key]}
                onChange={(e) =>
                  setFormData((p: any) => ({
                    ...p,
                    [key]: e.target.value,
                  }))
                }
                className="bg-[#242B35] border-none text-white mt-1"
              />
            </div>
          ))}

          {/* IS ACTIVE SWITCH */}
          <div className="space-y-2">
            <Label className="text-white text-xs">Is Active</Label>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.report === "yes"}
                onCheckedChange={(checked) =>
                  setFormData((prev: any) => ({
                    ...prev,
                    report: checked ? "yes" : "no",
                  }))
                }
                className="
                  data-[state=checked]:bg-[#B93DEB]
                  data-[state=unchecked]:bg-gray-600
                "
              />
              <span className="text-xs">
                {formData.report === "yes" ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-gray-600 text-white hover:bg-purple-500"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-[#B93DEB] text-white hover:bg-purple-500"
          >
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
