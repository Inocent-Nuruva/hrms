import React from "react";
import { AppState, View } from "react-native";
import { Button, Surface, Text } from "react-native-paper";
import { api } from "../lib/api";

export function MobileSessionBoundary({
  authenticated,
  logout,
  children,
}: {
  authenticated: boolean;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const action = React.useRef<() => void>(() => {});
  const [warning, setWarning] = React.useState<{
    seconds: number;
    idle: boolean;
  } | null>(null);
  React.useEffect(() => {
    if (!authenticated) return;
    let active = true,
      busy = false,
      idle = 0,
      hard = 0,
      lastActivity = 0,
      lastRead = 0;
    const sync = async (activity = false) => {
      if (!active || busy || AppState.currentState === "background") return;
      busy = true;
      lastRead = Date.now();
      if (activity) lastActivity = lastRead;
      try {
        const data = await api.sessionDeadlines(activity);
        if (!active) return;
        const offset = Date.now() - data.server_time;
        idle = data.idle_expires_at + offset;
        hard =
          Math.min(data.refresh_expires_at, data.absolute_expires_at) + offset;
        if (Math.min(idle, hard) > Date.now() + 60000) setWarning(null);
      } catch (error) {
        if (
          active &&
          ((error as { status?: number }).status === 401 ||
            (idle && Math.min(idle, hard) <= Date.now()))
        )
          await logout();
      } finally {
        busy = false;
      }
    };
    action.current = () => {
      if (
        Date.now() - lastActivity >= 15000 ||
        (idle && idle - Date.now() <= 60000)
      )
        void sync(true);
    };
    void sync();
    const interval = setInterval(() => {
      if (AppState.currentState === "background") return;
      const left = Math.min(idle, hard) - Date.now();
      if (idle && left <= 60000)
        setWarning({
          seconds: Math.max(0, Math.ceil(left / 1000)),
          idle: idle < hard,
        });
      if (
        (!idle || left <= 0 || Date.now() - lastRead >= 60000) &&
        Date.now() - lastRead >= 3000
      )
        void sync();
    }, 1000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    return () => {
      active = false;
      action.current = () => {};
      clearInterval(interval);
      subscription.remove();
      setWarning(null);
    };
  }, [authenticated, logout]);
  return (
    <View style={{ flex: 1 }} onTouchStart={() => action.current()}>
      {children}
      {authenticated && warning && (
        <Surface
          accessibilityRole="alert"
          style={{
            padding: 16,
            position: "absolute",
            bottom: 24,
            left: 12,
            right: 12,
          }}
          elevation={3}
        >
          <Text>Your session expires in {warning.seconds} seconds.</Text>
          {warning.idle ? (
            <Button onPress={() => action.current()}>Stay signed in</Button>
          ) : (
            <Text>Save your work and sign in again when the session ends.</Text>
          )}
        </Surface>
      )}
    </View>
  );
}
