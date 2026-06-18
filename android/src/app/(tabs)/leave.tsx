import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { LeaveScreen } from '../../screens/LeaveScreen';
import { useAuth } from '../../hooks/useAuth';

export default function LeaveTab() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ requestId?: string }>();
  return <LeaveScreen auth={auth} requestId={typeof params.requestId === 'string' ? params.requestId : undefined} />;
}
