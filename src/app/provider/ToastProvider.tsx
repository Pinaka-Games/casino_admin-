"use client";
import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      // react-hot-toast's container defaults to z-index 9999 — the same as the
      // sub-agent / confirm modals (z-[9999]/z-[10000]), so toasts fired from
      // inside an open modal (e.g. "email already in use" on sub-agent register)
      // rendered BEHIND the modal overlay and were invisible. Lift the container
      // above every modal so those toasts are always seen.
      containerStyle={{ zIndex: 2147483647 }}
      toastOptions={{
        duration: 3000,
        style: {
          background: "#242B35",
          color: "#ffffff",
          borderRadius: "10px",
          border: "1px solid #2a2e38",
          padding: "10px 14px",
          fontSize: "14px",
        },

        // Success Toast
        success: {
          iconTheme: {
            primary: "#0CB826", 
            secondary: "#242B35",
          },
        },

        // Error Toast
        error: {
          iconTheme: {
            primary: "#ff4d4f",
            secondary: "#242B35",
          },
        },
      }}
    />
  );
}