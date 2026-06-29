import React from 'react';
import { MyAttendanceScreen } from '../screens/MyAttendanceScreen';
import { useAuth } from '../hooks/useAuth';

export default function MyAttendancePage() {
  const auth = useAuth();
  return <MyAttendanceScreen auth={auth} />;
}
