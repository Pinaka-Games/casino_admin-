"use client"

import { useState } from "react"
import { motion } from "framer-motion"

export default function Tabs() {
  const [activeTab, setActiveTab] = useState<"claim" | "$0.00">("claim")

  return (
    <section className="px-2 pt-8 pb-2 w-full">
      <div className="w-full max-w-full mx-auto relative flex bg-black rounded-full p-1">
        
        {/* Animated Indicator */}
        <motion.div
          className="absolute top-1 bottom-1 rounded-full bg-[#B93DEB]"
          layout
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          initial={false}
          animate={{
            left: activeTab === "claim" ? "50%" : "4px",
            width: "calc(50% - 6px)",
          }}
        />

        {/* Tabs */}
        <button
          onClick={() => setActiveTab("$0.00")}
          className={`w-1/2 text-center relative z-10 px-6 py-2 rounded-full transition-colors duration-300 ${
            activeTab === "$0.00" ? "text-white" : "text-gray-100"
          }`}
        >
          $0.00
        </button>

        <button
          onClick={() => setActiveTab("claim")}
          className={`w-1/2 text-center relative z-10 px-6 py-2 rounded-full transition-colors duration-300 ${
            activeTab === "claim" ? "text-white" : "text-gray-100"
          }`}
        >
          Claim
        </button>
      </div>
    </section>
  )
}
