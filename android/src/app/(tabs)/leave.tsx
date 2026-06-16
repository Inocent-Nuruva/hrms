import React from 'react';
import { LeaveScreen } from '../../screens/LeaveScreen';
import { useAuth } from '../../hooks/useAuth';

export default function LeaveTab() {
  const auth = useAuth();
  return <LeaveScreen auth={auth} />;
}
