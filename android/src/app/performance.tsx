import React from 'react';
import { api } from '../lib/api';
import { MeListScreen } from '../screens/MeListScreen';

export default function PerformanceScreen() {
  return (
    <MeListScreen
      title="My performance"
      empty="No performance assignments yet."
      load={() => api.listMyPerformanceAssignments()}
    />
  );
}
