import * as React from "react"

import { cn } from "@/lib/utils"

function getDefaultAutoComplete({
  autoComplete,
  id,
  name,
  type,
}: Pick<React.ComponentProps<"input">, "autoComplete" | "id" | "name" | "type">) {
  if (autoComplete) {
    return autoComplete
  }

  const fieldKey = `${name ?? ""} ${id ?? ""}`.toLowerCase()

  if (type === "password" || fieldKey.includes("password")) {
    return "new-password"
  }

  return "off"
}

function Input({
  autoComplete,
  className,
  id,
  name,
  type,
  ...props
}: React.ComponentProps<"input">) {
  const resolvedAutoComplete = getDefaultAutoComplete({
    autoComplete,
    id,
    name,
    type,
  })

  return (
    <input
      type={type}
      id={id}
      name={name}
      autoComplete={resolvedAutoComplete}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-[#191D24] border-input h-10 w-full min-w-0 rounded-md border bg-[#000000] px-3 py-1 text-base  transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-[red] file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[1px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
