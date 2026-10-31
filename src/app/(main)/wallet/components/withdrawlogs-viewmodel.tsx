"use client";

import { X } from "lucide-react";

/* =========================
   TYPES
========================= */
export interface WithdrawInformation {
  referenceId: string;
  fullName: string;
  accountHolderName: string;
  phone?: string;
  channel: string;
  paymentGateway?: string;
  status: string;
  payAmount: string;
  receiveAmount: string;
  createdAt: string;
  attachment?: string;
  withdrawOrderCreated: string;
  orderReviewing: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: WithdrawInformation | null;
}

/* =========================
   COMPONENT
========================= */
export default function WithdrawInformationModal({
  open,
  onClose,
  data,
}: Props) {
  if (!open || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-3xl rounded-xl bg-[#15181E] p-6 relative">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-lg font-medium">Information</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="space-y-3 text-sm">
          <Info label="Reference Id" value={data.referenceId} />
          <Info label="Full Name" value={data.fullName} />
          <Info label="Account Holder Name" value={data.accountHolderName} />
          <Info label="Phone" value={data.phone || "-"} />
          <Info label="Channel" value={data.channel} />
          <Info label="Gateway" value={data.paymentGateway || "-"} />
          <Info label="Status" value={data.status} />
          <Info label="Pay Amount" value={data.payAmount} />
          <Info label="Receive Amount" value={data.receiveAmount} />
          <Info label="Created At" value={data.createdAt} />
          <Info label="Attachment" value={data.attachment || "-"} />
          <Info
            label="Withdraw Order Created"
            value={data.withdrawOrderCreated}
          />
          <Info label="Order Reviewing" value={data.orderReviewing} />
        </div>
      </div>
    </div>
  );
}

/* =========================
   INFO ROW
========================= */
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="w-56 text-gray-400">{label} :</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
