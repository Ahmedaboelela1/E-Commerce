"use client"

import {useTranslations} from "next-intl"
import * as React from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function PasswordInput({ className, disabled, ...props }: Omit<React.ComponentProps<"input">, "type">) {
    const t=useTranslations("Common")
    const [showPassword, setShowPassword] = React.useState(false)

    return (
        <div className="relative">
            <Input
                type={showPassword ? "text" : "password"}
                className={cn("pe-10", className)}
                disabled={disabled}
                {...props}
            />
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                disabled={disabled}
                tabIndex={-1}
                className="absolute inset-y-0 end-1 my-auto text-muted-foreground hover:text-foreground"
            >
                {showPassword ? (
                    <EyeOff className="size-4" />
                ) : (
                    <Eye className="size-4" />
                )}
            </Button>
        </div>
    )
}

export { PasswordInput }
