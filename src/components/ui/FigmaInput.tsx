"use client";

import React from "react";

interface FigmaInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  language?: string;
}

function getDefaultAutoComplete({
  autoComplete,
  id,
  name,
  type,
}: Pick<FigmaInputProps, "autoComplete" | "id" | "name" | "type">) {
  if (autoComplete) {
    return autoComplete;
  }

  const fieldKey = `${name ?? ""} ${id ?? ""}`.toLowerCase();

  if (type === "password" || fieldKey.includes("password")) {
    return "new-password";
  }

  return "off";
}

export default function FigmaInput({
  autoComplete,
  id,
  name,
  value,
  onChange,
  placeholder,
  language,
  type = "text",
  disabled = false,
  className,
  ...props
}: FigmaInputProps) {
  const resolvedAutoComplete = getDefaultAutoComplete({
    autoComplete,
    id,
    name,
    type,
  });

  return (
    <div
      className={`
        flex items-center
        w-full h-14
        rounded-lg
        bg-[#15181E]
        border border-[#2a2f3a]
        overflow-hidden   
        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
              
        ${className || ""}
      `}
    >
      {/* INPUT */}
      <div className="flex-1 h-full px-4 flex items-center">
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={resolvedAutoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          {...props}
          className="
            w-full
            bg-transparent
            text-white
            text-sm
            outline-none
            placeholder:text-gray-500
            disabled:opacity-50  
            [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
          "
        />
      </div>

      {/* LANGUAGE BUTTON */}
      {language && (
        <div
          className="
            h-full
            px-4
            flex items-center justify-center
            bg-[#1F2630]
            border-l border-[#2a2f3a]
            text-white
            text-sm
            whitespace-nowrap
          "
        >
          {language}
        </div>
      )}
    </div>
  );
}
