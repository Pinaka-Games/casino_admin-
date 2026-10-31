import React, { useState } from "react";
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
import { Role } from "@/types/role.type";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface RoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  onSubmit: (data: any) => Promise<void>; // ✅ IMPORTANT (was void)
}

export function RoleDialog({
  open,
  onOpenChange,
  role,
  onSubmit,
}: RoleDialogProps) {
  const isEdit = Boolean(role);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState<string>("true");
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description || "");
      setIsActive(role.isActive ? "true" : "false");
    } else {
      setName("");
      setDescription("");
      setIsActive("true");
    }
    setErrors({});
  }, [role, open]);

  const handleSubmit = async () => {
    const newErrors: { name?: string } = {};

    if (!name || name.length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const submitData = {
      name,
      description,
      isActive: isActive === "true",
    };

    try {
      setSubmitting(true);

      if (isEdit && role) {
        await onSubmit({ ...submitData, id: role.id });
      } else {
        await onSubmit(submitData);
      }

      // ✅ close ONLY after success
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      // ✅ prevent closing while saving (esc/outside click)
      onOpenChange={(nextOpen) => {
        if (submitting) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="bg-[#15181E] text-white border-gray-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-lg">
            {isEdit ? "Edit Role" : "Create New Role"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-gray-300 text-sm">Role Name*</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter role name"
              disabled={submitting}
              className="bg-[#242B35] border-gray-700 text-white placeholder:text-gray-500 mt-1"
            />
            {errors.name && (
              <p className="text-red-400 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <Label className="text-gray-300 text-sm">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description"
              disabled={submitting}
              className="bg-[#242B35] border-gray-700 text-white placeholder:text-gray-500 mt-1"
            />
          </div>

          <div>
            <Label className="text-gray-300 text-sm">Status</Label>
            <Select
              value={isActive}
              onValueChange={setIsActive}
              disabled={submitting}
            >
              <SelectTrigger className="bg-[#242B35] border-gray-700 text-white mt-1">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="bg-[#4A5568] hover:bg-[#5A6578] text-white"
          >
            Cancel
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : isEdit ? (
              "Update"
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
