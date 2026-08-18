import React from 'react';
import { api } from '../lib/api';
import { MeListScreen } from '../screens/MeListScreen';

export default function FinanceScreen() {
  return (
    <MeListScreen
      title="My finance"
      empty="No loan or advance applications yet."
      load={() => api.listMyFinanceApplications()}
    />
  );
}
