"use client";

import * as React from "react";
import {
  Button as FluentButton,
  type ButtonProps as FluentButtonProps,
} from "@fluentui/react-components";
import { cn } from "@/lib/utils";
import {
  liquidButtonVariants,
  type LiquidButtonProps,
} from "@/components/animate-ui/components/buttons/liquid";

const buttonVariants = liquidButtonVariants;
const FluentAnchorButton = FluentButton as React.ComponentType<
  Omit<FluentButtonProps, "onClick"> &
    React.AnchorHTMLAttributes<HTMLAnchorElement>
>;

type ButtonProps = Omit<
  FluentButtonProps,
  "appearance" | "onClick" | "size"
> & {
  variant?: LiquidButtonProps["variant"] | "result";
  appearance?: FluentButtonProps["appearance"];
  size?: LiquidButtonProps["size"] | "small" | "medium" | "large";
  href?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  render?: React.ReactElement;
};

function Button({
  variant = "default",
  size = "default",
  appearance,
  className,
  children,
  render,
  ...props
}: ButtonProps) {
  const fluentAppearance =
    appearance ??
    (variant === "default"
      ? "primary"
      : variant === "outline"
        ? "outline"
        : variant === "secondary"
          ? "secondary"
          : variant === "destructive"
            ? "primary"
            : "subtle");
  const fluentSize =
    size === "lg" || size === "large"
      ? "large"
      : size === "default" || size === "medium"
        ? "medium"
        : "small";
  const tone = fluentAppearance === "primary" ? "brand" : undefined;
  const iconSizeClass = size?.startsWith("icon")
    ? size === "icon-lg"
      ? "min-w-9 h-9 p-0"
      : size === "icon-xs"
        ? "min-w-6 h-6 p-0"
        : "min-w-7 h-7 p-0"
    : undefined;
  const variantClass =
    variant === "destructive"
      ? "!border-destructive !bg-destructive !text-white hover:!bg-destructive/90"
      : variant === "link"
        ? "h-auto border-0 bg-transparent px-0 text-primary underline-offset-4 hover:bg-transparent hover:underline"
        : undefined;

  if (render && React.isValidElement(render)) {
    const linkProps =
      render.props as React.AnchorHTMLAttributes<HTMLAnchorElement>;

    return (
      <FluentAnchorButton
        {...linkProps}
        as="a"
        appearance={fluentAppearance}
        data-hrms-button-tone={tone}
        size={fluentSize}
        className={cn(
          iconSizeClass,
          variantClass,
          linkProps.className,
          className,
        )}
      >
        {children ?? linkProps.children}
      </FluentAnchorButton>
    );
  }

  const fluentProps = props as FluentButtonProps;

  return (
    <FluentButton
      {...fluentProps}
      appearance={fluentAppearance}
      data-hrms-button-tone={tone}
      size={fluentSize}
      className={cn(iconSizeClass, variantClass, className)}
    >
      {children}
    </FluentButton>
  );
}

export { Button, buttonVariants };
