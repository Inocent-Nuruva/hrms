"use client";
import type { ReactNode } from "react";
import {
  MessageBar,
  MessageBarBody,
  type MessageBarProps,
} from "@fluentui/react-components";
export function FluentNotice({
  children,
  intent = "info",
}: {
  children: ReactNode;
  intent?: MessageBarProps["intent"];
}) {
  return (
    <MessageBar intent={intent} layout="multiline">
      <MessageBarBody>{children}</MessageBarBody>
    </MessageBar>
  );
}
