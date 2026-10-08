import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { LeaveScreen } from '../../screens/LeaveScreen';
import { useAuth } from '../../hooks/useAuth';

export default function LeaveTab() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ requestId?: string; tab?: string }>();
  const requestId = typeof params.requestId === 'string' ? params.requestId : undefined;
  const tab = typeof params.tab === 'string' ? params.tab : undefined;
  return <LeaveScreen auth={auth} requestId={requestId} initialTab={tab} />;
}
