import { Role } from '@/types/role.type';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { X } from "lucide-react";
import { Button } from "../ui/button";

interface ViewRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
}

export function ViewRoleDialog({ open, onOpenChange, role }: ViewRoleDialogProps) {
  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#15181E] text-white border-gray-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-lg">Role Details</DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-gray-400 text-xs mb-1">Role Name</p>
            <p className="text-white text-sm">{role.name}</p>
          </div>

          <div>
            <p className="text-gray-400 text-xs mb-1">Description</p>
            <p className="text-white text-sm">{role.description || '-'}</p>
          </div>

          <div>
            <p className="text-gray-400 text-xs mb-1">Status</p>
            <span className={`text-sm font-medium ${role.isActive ? 'text-[#04AD37]' : 'text-red-400'}`}>
              {role.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div>
            <p className="text-gray-400 text-xs mb-1">Created At</p>
            <p className="text-white text-sm">
              {new Date(role.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          <div>
            <p className="text-gray-400 text-xs mb-1">Updated At</p>
            <p className="text-white text-sm">
              {new Date(role.updatedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-[#4A5568] hover:bg-[#5A6578] text-white border-none px-6 w-full"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}