"use client";

import {
  Button,
  OverlayDrawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
  Text,
} from "@fluentui/react-components";
import { Dismiss20Regular, Folder20Regular } from "@fluentui/react-icons";
import { KpiCategoriesView } from "./kpi-categories-view";

export function KpiCategoriesFlyout({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  return (
    <OverlayDrawer
      open={open}
      position="end"
      size="medium"
      onOpenChange={(_event, data) => onOpenChange(data.open)}
      style={{
        width: "min(640px, 100vw)",
        fontFamily: "var(--font-comfortaa)",
      }}
    >
      <DrawerHeader
        style={{
          borderBottom: "1px solid var(--colorNeutralStroke2)",
          padding: "20px 24px",
        }}
      >
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              icon={<Dismiss20Regular />}
              aria-label="Close categories"
              onClick={() => onOpenChange(false)}
            />
          }
        >
          <span className="inline-flex items-center gap-2">
            <Folder20Regular />
            KPI categories
          </span>
        </DrawerHeaderTitle>
        <Text size={200}>
          Group KPIs by Delivery, Quality, or a category you create.
        </Text>
      </DrawerHeader>
      <DrawerBody style={{ padding: "20px", minWidth: 0 }}>
        {open ? <KpiCategoriesView embedded onChanged={onChanged} /> : null}
      </DrawerBody>
    </OverlayDrawer>
  );
}
