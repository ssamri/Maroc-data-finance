// Adapted from shadcn/ui's MIT-licensed Button. See THIRD_PARTY_NOTICES.md.
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("btn inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed", {
  variants: {
    variant: { default: "btn-primary", outline: "btn-outline", ghost: "btn-ghost", secondary: "btn-secondary" },
    size: { default: "", sm: "btn-sm", icon: "btn-icon" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
export { Button, buttonVariants };
