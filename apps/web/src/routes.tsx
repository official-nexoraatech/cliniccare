import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Login } from '@/pages/auth/Login';
import { Dashboard } from '@/pages/dashboard/Dashboard';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { PatientListPage } from '@/pages/patients/PatientListPage';
import { PatientForm } from '@/pages/patients/PatientForm';
import { PatientProfilePage } from '@/pages/patients/PatientProfilePage';
import { ComplianceReportPage } from '@/pages/compliance/ComplianceReportPage';
import { FollowUpPage } from '@/pages/followups/FollowUpPage';
import { AppointmentsPage } from '@/pages/appointments/AppointmentsPage';
import { MedicineListPage } from '@/pages/medicines/MedicineListPage';
import { MedicineForm } from '@/pages/medicines/MedicineForm';
import { TodaysVisitsPage } from '@/pages/visits/TodaysVisitsPage';
import { ConsultationPage } from '@/pages/visits/ConsultationPage';
import { PrescriptionPage } from '@/pages/visits/PrescriptionPage';
import { CertificatesPage } from '@/pages/certificates/CertificatesPage';
import { BillingPage } from '@/pages/billing/BillingPage';
import { AccountsPage } from '@/pages/accounts/AccountsPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: '/', element: <Dashboard /> },
          { path: '/patients', element: <PatientListPage /> },
          { path: '/patients/new', element: <PatientForm /> },
          { path: '/patients/:id', element: <PatientProfilePage /> },
          { path: '/appointments', element: <Navigate to="/appointments/booking-info" replace /> },
          { path: '/appointments/:view', element: <AppointmentsPage /> },
          { path: '/visits', element: <TodaysVisitsPage /> },
          { path: '/visits/:id', element: <ConsultationPage /> },
          { path: '/visits/:id/prescription', element: <PrescriptionPage /> },
          { path: '/medicines', element: <MedicineListPage /> },
          { path: '/medicines/new', element: <MedicineForm /> },
          { path: '/medicines/:id/edit', element: <MedicineForm /> },
          { path: '/follow-up', element: <FollowUpPage /> },
          { path: '/compliance', element: <ComplianceReportPage /> },
          { path: '/certificates', element: <CertificatesPage /> },
          { path: '/billing', element: <BillingPage /> },
          { path: '/accounts', element: <AccountsPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/settings', element: <Navigate to="/settings/clinic" replace /> },
          { path: '/settings/:tab', element: <SettingsPage /> },
        ],
      },
    ],
  },
]);
