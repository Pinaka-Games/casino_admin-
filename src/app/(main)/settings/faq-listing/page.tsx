"use client";

import * as React from "react";
import toast from "react-hot-toast";

import { useFaqStore } from "@/store/faq-store";
import { FAQ } from "@/types/faq";

import { FAQTable } from "./components/faq-table";
import { FaqDialog } from "./components/faq-dialog";
import { DeleteFaqDialog } from "./components/delete-faq-dialog";

export default function FAQListingPage() {
  const {
    faqs,
    loading, // ✅ take from store
    fetchFaqs,
    createFaq,
    updateFaq,
    deleteFaq,
  } = useFaqStore();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<FAQ | null>(null);

  React.useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const handleSubmit = async (data: any) => {
    try {
      if (selected) {
        await updateFaq(selected.id, data);
        toast.success("FAQ updated");
      } else {
        await createFaq(data);
        toast.success("FAQ created");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Operation failed");
    }
  };

  return (
    <>
      <FAQTable
        data={faqs}
        loading={loading} // ✅ THIS WAS MISSING
        onCreate={() => {
          setSelected(null);
          setDialogOpen(true);
        }}
        onEdit={(item) => {
          setSelected(item);
          setDialogOpen(true);
        }}
        onDelete={(item) => {
          setSelected(item);
          setDeleteOpen(true);
        }}
      />

      <FaqDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        faq={selected}
        onSubmit={handleSubmit}
      />

      <DeleteFaqDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        faq={selected}
        onConfirm={async () => {
          if (!selected) return;
          try {
            await deleteFaq(selected.id);
            toast.success("FAQ removed");
            setDeleteOpen(false);
          } catch {
            toast.error("Failed to remove FAQ");
          }
        }}
      />
    </>
  );
}