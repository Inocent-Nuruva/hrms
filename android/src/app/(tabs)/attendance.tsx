import React from 'react';
import { AttendanceScreen } from '../../screens/AttendanceScreen';
import { useAuth } from '../../hooks/useAuth';

export default function AttendanceTab() {
  const auth = useAuth();
  return <AttendanceScreen auth={auth} />;
}
